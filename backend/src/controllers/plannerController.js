import Subject from '../models/Subject.js'
import Chapter from '../models/Chapter.js'
import StudyPlan from '../models/StudyPlan.js'
import { generateSchedule, detectBurnout } from '../utils/plannerLogic.js'

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

    // delete old plan if exists
    await StudyPlan.deleteOne({ user: req.user.id })

    // save new plan to database
    const studyPlan = await StudyPlan.create({
      user: req.user.id,
      startDate: new Date(startDate),
      dailyStudyHours,
      schedule
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