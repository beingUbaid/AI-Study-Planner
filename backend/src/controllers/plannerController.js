import Subject from '../models/Subject.js'
import Chapter from '../models/Chapter.js'
import StudyPlan from '../models/StudyPlan.js'
import { generateSchedule, detectBurnout } from '../utils/plannerLogic.js'
import { rebalanceStudyPlan } from '../utils/rebalanceHelper.js'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

// ─────────────────────────────────────────
// ADD CHAPTERS TO A SUBJECT
// ─────────────────────────────────────────
export const addChapters = async (req, res) => {
  try {
    const { chapters } = req.body
    const { subjectId } = req.params

    // verify subject belongs to this user
    const subject = await Subject.findOne({ 
      _id: subjectId, 
      user: req.user.id 
    })

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' })
    }

    if (!chapters || chapters.length === 0) {
      return res.status(400).json({ message: 'Please provide chapters' })
    }

    // delete old chapters first (replacing with new ones)
    await Chapter.deleteMany({ subject: subjectId, user: req.user.id })

    // create all chapters at once
    const chapterDocs = chapters.map((ch, index) => ({
      user: req.user.id,
      subject: subjectId,
      name: typeof ch === 'string' ? ch : ch.name,
      estimatedHours: typeof ch === 'string' ? 1 : (ch.estimatedHours || 1),
      order: index + 1
    }))

    const savedChapters = await Chapter.insertMany(chapterDocs)

    // update total chapters count on subject
    subject.totalChapters = savedChapters.length
    await subject.save()

    res.status(201).json({
      message: 'Chapters added successfully ✅',
      chapters: savedChapters
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// GET CHAPTERS OF A SUBJECT
// ─────────────────────────────────────────
export const getChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find({ 
      subject: req.params.subjectId, 
      user: req.user.id 
    }).sort({ order: 1 })

    res.status(200).json({ chapters })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// GENERATE STUDY PLAN
// ─────────────────────────────────────────
export const generatePlan = async (req, res) => {
  try {
    const { dailyStudyHours, startDate } = req.body

    if (!dailyStudyHours || !startDate) {
      return res.status(400).json({ message: 'Daily study hours and start date are required' })
    }

    // get all subjects of this user
    const subjects = await Subject.find({ user: req.user.id })

    if (subjects.length === 0) {
      return res.status(400).json({ message: 'Please add subjects first' })
    }

    // get chapters for each subject
    const subjectsWithChapters = await Promise.all(
      subjects.map(async (subject) => {
        const chapters = await Chapter.find({ 
          subject: subject._id, 
          user: req.user.id 
        }).sort({ order: 1 })

        return {
          subjectId: subject._id,
          name: subject.name,
          color: subject.color,
          examDate: subject.examDate,
          chapters
        }
      })
    )

    // filter out subjects with no chapters
    const validSubjects = subjectsWithChapters.filter(s => s.chapters.length > 0)

    if (validSubjects.length === 0) {
      return res.status(400).json({ message: 'Please add chapters to your subjects first' })
    }

    // run our algorithm
    const schedule = generateSchedule(validSubjects, dailyStudyHours, startDate)

    // check for burnout
    const burnout = detectBurnout(schedule, dailyStudyHours)

    // Generate AI explanation
    let aiExplanation = ''
    try {
      const subjectContext = validSubjects.map(s => {
        const daysLeft = s.examDate ? Math.ceil((new Date(s.examDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) : 'N/A'
        return `${s.name} (exam in ${daysLeft} days)`
      }).join(', ')

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are an expert academic advisor and AI Study Planner.
            The student has generated a study schedule. Analyze their subject priority and explain why this plan is optimized for them.
            
            Subjects: ${subjectContext}
            Daily Study Hours: ${dailyStudyHours} hours/day.
            Total Days of generated schedule: ${schedule.length} days.
            
            Generate a short, bullet-point explanation (maximum 4 points) of why this plan was structured this way:
            - Highlight why certain subjects are prioritized (e.g. exams coming up sooner).
            - Highlight study time distribution based on difficulty or progress.
            - Mention that revision days have been strategically added.
            - Keep it encouraging, professional, and clear.
            - Return clean markdown format. Do NOT include any markdown code blocks or wrapper tags around it, just the raw text.`
          }
        ],
        max_tokens: 400
      })
      aiExplanation = completion.choices[0].message.content.trim()
    } catch (err) {
      console.error('Groq AI Explanation failed, using fallback:', err.message)
      aiExplanation = `Plan optimized successfully. Priority given to subjects with closer exam dates. Daily study hours capped at ${dailyStudyHours} hours to prevent burnout, with revision buffers added before exams.`
    }

    // delete old plan if exists
    await StudyPlan.deleteOne({ user: req.user.id })

    // save new plan to database
    const studyPlan = await StudyPlan.create({
      user: req.user.id,
      startDate: new Date(startDate),
      dailyStudyHours,
      schedule,
      aiExplanation
    })

    res.status(201).json({
      message: 'Study plan generated successfully ✅',
      burnoutWarning: burnout,
      totalDays: schedule.length,
      studyPlan
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// GET FULL SCHEDULE
// ─────────────────────────────────────────
export const getSchedule = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan) {
      return res.status(404).json({ message: 'No study plan found. Please generate one first.' })
    }

    res.status(200).json({ studyPlan })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// GET TODAY'S TASKS
// ─────────────────────────────────────────
export const getTodayTasks = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan) {
      return res.status(404).json({ message: 'No study plan found' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // find today's entry in the schedule
    const todayPlan = studyPlan.schedule.find(day => {
      const planDate = new Date(day.date)
      planDate.setHours(0, 0, 0, 0)
      return planDate.getTime() === today.getTime()
    })

    if (!todayPlan) {
      return res.status(200).json({ 
        message: 'No tasks scheduled for today',
        tasks: [],
        isBreakDay: false
      })
    }

    res.status(200).json({
      date: todayPlan.date,
      dayName: todayPlan.dayName,
      isBreakDay: todayPlan.isBreakDay,
      totalHours: todayPlan.totalHours,
      tasks: todayPlan.tasks
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// MARK TASK AS COMPLETE
// ─────────────────────────────────────────
export const markTaskComplete = async (req, res) => {
  try {
    const { dayIndex, taskIndex } = req.body

    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan) {
      return res.status(404).json({ message: 'No study plan found' })
    }

    // toggle complete
    const task = studyPlan.schedule[dayIndex].tasks[taskIndex]
    task.isCompleted = !task.isCompleted

    await studyPlan.save()

    res.status(200).json({ 
      message: task.isCompleted ? 'Task completed ✅' : 'Task marked pending',
      isCompleted: task.isCompleted
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// EXPORT ICS (iCALENDAR FILE FOR GOOGLE CALENDAR)
// ─────────────────────────────────────────
export const exportICS = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan || !studyPlan.schedule.length) {
      return res.status(404).json({ message: 'No study plan schedule found to export' })
    }

    const formatICSDate = (dateObj) => {
      const d = new Date(dateObj)
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Study Planner//NONSGML v1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:AI Study Schedule'
    ]

    studyPlan.schedule.forEach((day, dIdx) => {
      day.tasks.forEach((t, tIdx) => {
        const start = new Date(day.date)
        start.setHours(9 + (tIdx * 2), 0, 0, 0)
        const end = new Date(start)
        end.setHours(start.getHours() + (t.estimatedHours || 1))

        icsContent.push(
          'BEGIN:VEVENT',
          `UID:study-task-${dIdx}-${tIdx}-${Date.now()}@studyplanner.ai`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `DTSTART:${formatICSDate(start)}`,
          `DTEND:${formatICSDate(end)}`,
          `SUMMARY:${t.subjectName || 'Study'}: ${t.chapterName || 'Session'}`,
          `DESCRIPTION:AI Study Planner Task. Subject: ${t.subjectName || 'General'}, Estimated: ${t.estimatedHours || 1} hour(s)`,
          'STATUS:CONFIRMED',
          'END:VEVENT'
        )
      })
    })

    icsContent.push('END:VCALENDAR')
    const finalFile = icsContent.join('\r\n')

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="study_schedule.ics"')
    res.send(finalFile)

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// ADAPTIVE AI REBALANCE SCHEDULE (MISSED TASKS)
// ─────────────────────────────────────────
export const rebalancePlan = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan || !studyPlan.schedule.length) {
      return res.status(404).json({ message: 'No active study plan to rebalance' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { rescheduledCount, missedTasks } = rebalanceStudyPlan(studyPlan, today)

    if (rescheduledCount === 0) {
      return res.status(200).json({
        message: 'No missed tasks found! Your schedule is on track 🎉',
        rescheduledCount: 0,
        studyPlan,
        explanation: 'Your schedule is currently fully on track! No missed tasks to redistribute.'
      })
    }

    await studyPlan.save()

    // Generate AI explanation for rebalance
    let explanation = ''
    try {
      const missedDetails = missedTasks.map(t => `- ${t.subjectName}: ${t.chapterName}`).join('\n')

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are an expert AI Study Assistant.
            The student has missed study sessions and the system has dynamically redistributed their unfinished tasks.
            Explain the updates to their study plan clearly, directly, and encouragingly.
            
            Missed tasks that were rescheduled:
            ${missedDetails}
            
            Daily study hour limit: ${studyPlan.dailyStudyHours} hours.
            
            Formulate a friendly response explaining what changes were made (e.g., "I shifted your unfinished Physics session into tomorrow's schedule without increasing your study workload past the ${studyPlan.dailyStudyHours}-hour daily limit.").
            Ensure the response is extremely human, brief, direct, and encouraging. Do NOT include markdown code blocks or wrapping tags.`
          }
        ],
        max_tokens: 250
      })
      explanation = completion.choices[0].message.content.trim()
    } catch (err) {
      console.error('Groq Rebalance Explanation failed, using fallback:', err.message)
      explanation = `Your plan has been updated! I redistributed ${rescheduledCount} unfinished task(s) across the upcoming days without increasing your study workload past the ${studyPlan.dailyStudyHours} hours/day limit.`
    }

    res.status(200).json({
      message: `AI rebalanced schedule! ${rescheduledCount} missed task(s) rescheduled ✅`,
      rescheduledCount,
      studyPlan,
      explanation
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
