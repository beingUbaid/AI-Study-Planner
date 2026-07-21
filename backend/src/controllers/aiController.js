import Groq from 'groq-sdk'
import fs from 'fs'
import Subject from '../models/Subject.js'
import Chapter from '../models/Chapter.js'
import StudyPlan from '../models/StudyPlan.js'
import { extractTextFromPDF } from '../utils/pdfExtract.js'

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
        
        Keep responses short, friendly and actionable.
        Use emojis to make responses more engaging.
        If asked about specific topics, give study tips.`
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

    const aiResponse = completion.choices[0].message.content

    res.status(200).json({
      message: 'Response generated ✅',
      response: aiResponse,
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