import Groq from 'groq-sdk'
import fs from 'fs'
import Subject from '../models/Subject.js'
import Chapter from '../models/Chapter.js'
import StudyPlan from '../models/StudyPlan.js'
import { extractTextFromPDF } from '../utils/pdfExtract.js'
import { rebalanceStudyPlan } from '../utils/rebalanceHelper.js'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

// ─────────────────────────────────────────
// 1. AI SCHEDULE GENERATOR
// ─────────────────────────────────────────
export const aiGenerateSchedule = async (req, res) => {
  try {
    const { message } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Please describe your study situation' })
    }

    const subjects = await Subject.find({ user: req.user.id })
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    const subjectContext = subjects.length > 0
      ? subjects.map(s => {
          const daysLeft = Math.ceil((new Date(s.examDate) - new Date()) / (1000 * 60 * 60 * 24))
          return `${s.name} (exam in ${daysLeft} days, difficulty: ${s.difficulty})`
        }).join(', ')
      : 'No subjects added yet'

    const progressContext = studyPlan
      ? `Student has an existing study plan with ${studyPlan.schedule.length} days`
      : 'No study plan yet'

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert study planner AI for students.
          Your job is to create smart, realistic study schedules.
          
          Student's current subjects: ${subjectContext}
          Study plan status: ${progressContext}
          
          When creating a schedule:
          - Prioritize subjects with closer exam dates
          - Include revision days before each exam
          - Add break days every 6-7 days
          - Warn about burnout if hours are too high
          - Be encouraging and motivating
          - Format the schedule clearly day by day
          - Keep responses concise and actionable`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1000
    })

    const aiResponse = completion.choices[0].message.content

    res.status(200).json({
      message: 'AI schedule generated ✅',
      response: aiResponse
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 2. AI STUDY ASSISTANT CHATBOT
// ─────────────────────────────────────────
export const aiChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Please send a message' })
    }

    const subjects = await Subject.find({ user: req.user.id })
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    let context = 'Student information:\n'

    if (subjects.length > 0) {
      context += 'Subjects:\n'
      subjects.forEach(s => {
        const daysLeft = Math.ceil(
          (new Date(s.examDate) - new Date()) / (1000 * 60 * 60 * 24)
        )
        context += `- ${s.name}: exam in ${daysLeft} days, difficulty: ${s.difficulty}\n`
      })
    }

    if (studyPlan) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayPlan = studyPlan.schedule.find(day => {
        const d = new Date(day.date)
        d.setHours(0, 0, 0, 0)
        return d.getTime() === today.getTime()
      })

      if (todayPlan) {
        context += `\nToday's tasks:\n`
        todayPlan.tasks.forEach(t => {
          context += `- ${t.subjectName}: ${t.chapterName} (${t.isCompleted ? 'completed ✅' : 'pending ⏳'})\n`
        })
      }

      const allTasks = studyPlan.schedule.flatMap(d => d.tasks)
      const completed = allTasks.filter(t => t.isCompleted).length
      context += `\nOverall progress: ${completed}/${allTasks.length} tasks completed`
    }

    const messages = [
      {
        role: 'system',
        content: `You are a friendly and motivating AI study assistant.
        Help students with their studies, answer questions, give advice, and keep them motivated.
        
        ${context}
        
        CRITICAL TOOL - AUTO-REBALANCE:
        If the student indicates that they missed their study hours, couldn't complete a scheduled session, or need to reschedule missed/unfinished tasks (e.g., 'I couldn't complete today's Physics session', 'I missed yesterday's study', 'reschedule missed tasks'), you MUST perform a rebalance.
        To do this, start your response with '[TRIGGER_REBALANCE]' on its own line, and then write a friendly, concise explanation of how you have redistributed their missed hours across the remaining days without exceeding their daily study hour limits.
        
        Keep responses short, friendly, and actionable.
        Use emojis to make responses more engaging.`
      },
      ...history.map(h => ({
        role: h.role,
        content: h.content
      })),
      {
        role: 'user',
        content: message
      }
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 500
    })

    let aiResponse = completion.choices[0].message.content
    let rebalanced = false
    let rescheduledCount = 0

    if (aiResponse.includes('[TRIGGER_REBALANCE]')) {
      aiResponse = aiResponse.replace('[TRIGGER_REBALANCE]', '').trim()
      if (studyPlan && studyPlan.schedule.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const result = rebalanceStudyPlan(studyPlan, today)
        rescheduledCount = result.rescheduledCount
        if (rescheduledCount > 0) {
          const logItem = {
            date: new Date(),
            trigger: `Chatbot request: "${message.length > 50 ? message.substring(0, 50) + '...' : message}"`,
            explanation: aiResponse
          }
          studyPlan.rebalanceLogs = studyPlan.rebalanceLogs || []
          studyPlan.rebalanceLogs.push(logItem)
          await studyPlan.save()
          rebalanced = true
        }
      }
      if (!rebalanced) {
        // If rebalance couldn't proceed because no tasks were actually missed or found
        aiResponse = aiResponse + "\n\n*(Note: I checked your schedule and everything is currently on track! No pending past tasks were found to reschedule.)*"
      }
    }

    res.status(200).json({
      message: 'Response generated ✅',
      response: aiResponse,
      rebalanced,
      rescheduledCount,
      history: [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse }
      ]
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 3. PDF SYLLABUS UPLOAD
// ─────────────────────────────────────────
export const uploadPDF = async (req, res) => {
  try {
    const { subjectId } = req.body

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file' })
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      user: req.user.id
    })

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' })
    }

    // extract text from PDF
    const pdfText = await extractTextFromPDF(req.file.path)

    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ message: 'Could not extract text from PDF' })
    }

    // send to Groq to extract chapters
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert at reading academic syllabi and textbooks.
          Extract chapter names and topics from the provided text.
          
          Return ONLY a JSON array like this, nothing else:
          [
            { "name": "Chapter 1 - Introduction", "estimatedHours": 2 },
            { "name": "Chapter 2 - Basic Concepts", "estimatedHours": 1.5 }
          ]
          
          Rules:
          - Extract actual chapter or topic names from the text
          - Estimate hours based on complexity (1-3 hours per chapter)
          - Maximum 20 chapters
          - Return ONLY the JSON array, no extra text at all`
        },
        {
          role: 'user',
          content: `Extract chapters from this syllabus:\n\n${pdfText.substring(0, 3000)}`
        }
      ],
      max_tokens: 1000
    })

    // parse AI response
    let chapters = []
    try {
      const responseText = completion.choices[0].message.content
      // clean response in case AI adds extra text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        chapters = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      return res.status(500).json({ 
        message: 'AI could not parse the PDF properly. Try a clearer PDF.' 
      })
    }

    // delete old chapters
    await Chapter.deleteMany({ subject: subjectId, user: req.user.id })

    // save new chapters
    const chapterDocs = chapters.map((ch, index) => ({
      user: req.user.id,
      subject: subjectId,
      name: ch.name,
      estimatedHours: ch.estimatedHours || 1,
      order: index + 1
    }))

    const savedChapters = await Chapter.insertMany(chapterDocs)

    subject.totalChapters = savedChapters.length
    await subject.save()

    // delete uploaded file after processing
    fs.unlinkSync(req.file.path)

    res.status(200).json({
      message: `PDF processed! ${savedChapters.length} chapters extracted ✅`,
      chapters: savedChapters
    })

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 4. AI FLASHCARD GENERATOR
// ─────────────────────────────────────────
export const aiGenerateFlashcards = async (req, res) => {
  try {
    const { subject = 'General', topic = 'Core Concepts', count = 5 } = req.body

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert academic tutor.
          Generate high-yield active-recall study flashcards.
          Return ONLY a JSON array, like this:
          [
            { "id": 1, "front": "Clear Question/Prompt?", "back": "Concise high-yield answer.", "category": "${subject}" }
          ]
          Rules:
          - Generate exactly ${count} flashcards.
          - Return ONLY valid JSON array. No explanations or extra text.`
        },
        {
          role: 'user',
          content: `Create flashcards for Subject: ${subject}, Topic: ${topic}`
        }
      ],
      max_tokens: 1200
    })

    const responseText = completion.choices[0].message.content
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const flashcards = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    res.status(200).json({
      message: 'Flashcards generated ✅',
      subject,
      topic,
      flashcards
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 5. AI INTERACTIVE PRACTICE QUIZ GENERATOR
// ─────────────────────────────────────────
export const aiGenerateQuiz = async (req, res) => {
  try {
    const { subject = 'General', topic = 'Core Concepts', difficulty = 'Medium', count = 4 } = req.body

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert academic examiner.
          Generate multiple-choice practice quiz questions.
          Return ONLY a JSON array, like this:
          [
            {
              "id": 1,
              "question": "Clear exam question?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswer": 0,
              "explanation": "Detailed step-by-step breakdown why option A is correct."
            }
          ]
          Rules:
          - Generate exactly ${count} questions.
          - "correctAnswer" must be the 0-based integer index of the right option (0, 1, 2, or 3).
          - Difficulty level: ${difficulty}.
          - Return ONLY valid JSON array. No markdown formatting around the JSON.`
        },
        {
          role: 'user',
          content: `Create a practice quiz for Subject: ${subject}, Topic: ${topic}, Difficulty: ${difficulty}`
        }
      ],
      max_tokens: 1500
    })

    const responseText = completion.choices[0].message.content
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const quiz = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    res.status(200).json({
      message: 'Quiz generated ✅',
      subject,
      topic,
      quiz
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 6. BEFORE EXAM MODE ROADMAP GENERATOR
// ─────────────────────────────────────────
export const aiGenerateExamMode = async (req, res) => {
  try {
    const { examDate, subjects, currentPrep, targetScore, availableHours } = req.body

    if (!examDate || !subjects) {
      return res.status(400).json({ message: 'Exam date and subjects are required' })
    }

    const today = new Date()
    const daysUntilExam = Math.ceil((new Date(examDate) - today) / (1000 * 60 * 60 * 24))

    if (daysUntilExam <= 0) {
      return res.status(400).json({ message: 'Exam date must be in the future!' })
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert exam preparation strategist.
          Generate a high-yield countdown roadmap to help the student prepare for their upcoming exam.
          Return ONLY a JSON array, like this:
          [
            { "days": "Days 1-3", "focus": "Target Weakest Chapters", "description": "Review notes for electromagnetism, highlight key formulas." },
            { "days": "Days 4-6", "focus": "Active Recall & Flashcards", "description": "Drill core definitions. Create visual mind-maps." }
          ]
          Rules:
          - Segment the days logically based on available days (${daysUntilExam} days total).
          - Provide at least 3 and at most 6 segments.
          - Incorporate the student's metrics: current preparation is ${currentPrep || 50}%, target score is ${targetScore || 90}%, available study hours per day is ${availableHours || 3} hours.
          - Return ONLY valid JSON array. No explanations or extra text.`
        },
        {
          role: 'user',
          content: `Generate countdown study plan for Subjects: ${subjects}. Exam in ${daysUntilExam} days.`
        }
      ],
      max_tokens: 1000
    })

    const responseText = completion.choices[0].message.content
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const countdownPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    res.status(200).json({
      message: 'Exam Mode roadmap generated ✅',
      daysUntilExam,
      countdownPlan
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}