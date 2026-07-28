import User from "../models/User.js"
import Subject from '../models/Subject.js'
import StudyPlan from '../models/StudyPlan.js'

export const getDashboard = async (req, res) => {
  try {
    // ─────────────────────────────────────────
    // 1. GET STUDENT INFO
    // ─────────────────────────────────────────
    const user = await User.findById(req.user.id).select('name email')

    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    let todayTasks = {
      total: 0,
      completed: 0,
      pending: 0,
      tasks: []
    }

    let studyHours = {
      todayCompleted: 0,
      totalCompleted: 0,
      totalPlanned: 0
    }

    let streak = {
      current: 0,
      message: 'Start studying to build your streak! 💪'
    }

    if (studyPlan) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // ─────────────────────────────────────────
      // 2. TODAY'S TASKS
      // ─────────────────────────────────────────
      const todayPlan = studyPlan.schedule.find(day => {
        const planDate = new Date(day.date)
        planDate.setHours(0, 0, 0, 0)
        return planDate.getTime() === today.getTime()
      })

      if (todayPlan && !todayPlan.isBreakDay) {
        const completed = todayPlan.tasks.filter(t => t.isCompleted)
        const pending = todayPlan.tasks.filter(t => !t.isCompleted)
        const dayIdx = studyPlan.schedule.findIndex(d => d._id.toString() === todayPlan._id.toString())

        const tasksWithIndices = todayPlan.tasks.map((t, taskIdx) => ({
          _id: t._id,
          subject: t.subject,
          subjectName: t.subjectName,
          subjectColor: t.subjectColor,
          chapter: t.chapter,
          chapterName: t.chapterName,
          estimatedHours: t.estimatedHours,
          isCompleted: t.isCompleted,
          isRevision: t.isRevision,
          dayIndex: dayIdx,
          taskIndex: taskIdx
        }))

        todayTasks = {
          total: todayPlan.tasks.length,
          completed: completed.length,
          pending: pending.length,
          tasks: tasksWithIndices
        }

        studyHours.todayCompleted = completed.reduce(
          (sum, t) => sum + (t.estimatedHours || 1), 0
        )
      }

      // ─────────────────────────────────────────
      // 3. TOTAL STUDY HOURS
      // ─────────────────────────────────────────
      for (const day of studyPlan.schedule) {
        for (const task of day.tasks) {
          studyHours.totalPlanned += task.estimatedHours
          if (task.isCompleted) {
            studyHours.totalCompleted += task.estimatedHours
          }
        }
      }

      // ─────────────────────────────────────────
      // 4. STREAK CALCULATOR
      // go backwards from today
      // if student completed at least 1 task → streak continues
      // if they missed a day → streak breaks
      // ─────────────────────────────────────────
      let streakCount = 0
      const sortedDays = [...studyPlan.schedule].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )

      for (const day of sortedDays) {
        const dayDate = new Date(day.date)
        dayDate.setHours(0, 0, 0, 0)

        if (dayDate > today) continue
        if (day.isBreakDay) { streakCount++; continue }

        const hasCompleted = day.tasks.some(t => t.isCompleted)
        if (hasCompleted) {
          streakCount++
        } else {
          break
        }
      }

      streak.current = streakCount
      if (streakCount >= 1) streak.message = `${streakCount} Day Study Streak 🔥`
    }

    // ─────────────────────────────────────────
    // 5. UPCOMING EXAMS (next 30 days)
    // ─────────────────────────────────────────
    const now = new Date()
    const next30 = new Date()
    next30.setDate(next30.getDate() + 30)

    const subjects = await Subject.find({
      user: req.user.id,
      examDate: { $gte: now, $lte: next30 }
    }).sort({ examDate: 1 })

    const upcomingExams = subjects.map(subject => {
      const daysRemaining = Math.ceil(
        (new Date(subject.examDate) - now) / (1000 * 60 * 60 * 24)
      )
      return {
        subject: subject.name,
        color: subject.color,
        examDate: subject.examDate,
        daysRemaining,
        difficulty: subject.difficulty
      }
    })

    // ─────────────────────────────────────────
    // 6. OVERALL PROGRESS %
    // ─────────────────────────────────────────
    let overallProgress = 0
    if (studyPlan) {
      const allTasks = studyPlan.schedule.flatMap(day => day.tasks)
      const totalTasks = allTasks.length
      const completedTasks = allTasks.filter(t => t.isCompleted).length
      overallProgress = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0
    }

    res.status(200).json({
      student: { name: user.name, email: user.email },
      todayTasks,
      upcomingExams,
      studyHours,
      streak,
      overallProgress
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}