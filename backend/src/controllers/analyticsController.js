import Analytics from '../models/Analytics.js'
import Subject from '../models/Subject.js'
import StudyPlan from '../models/StudyPlan.js'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─────────────────────────────────────────
// 1. LOG TODAY'S STUDY SESSION
// Call this whenever student marks tasks complete
// It saves today's progress to Analytics
// ─────────────────────────────────────────
export const logTodaySession = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan) {
      return res.status(404).json({ message: 'No study plan found' })
    }

    // get today's date (midnight)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // find today in the schedule
    const todayPlan = studyPlan.schedule.find(day => {
      const d = new Date(day.date)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === today.getTime()
    })

    if (!todayPlan) {
      return res.status(200).json({ message: 'No tasks scheduled for today' })
    }

    // calculate today's stats
    const completedTasks = todayPlan.tasks.filter(t => t.isCompleted)
    const totalHours = completedTasks.reduce((sum, t) => sum + t.estimatedHours, 0)

    // group by subject
    // example: { Physics: { hours: 2, tasks: 2 }, Math: { hours: 1, tasks: 1 } }
    const subjectMap = {}
    completedTasks.forEach(task => {
      if (!subjectMap[task.subjectName]) {
        subjectMap[task.subjectName] = {
          subjectName: task.subjectName,
          subjectColor: task.subjectColor,
          hoursStudied: 0,
          tasksCompleted: 0
        }
      }
      subjectMap[task.subjectName].hoursStudied += task.estimatedHours
      subjectMap[task.subjectName].tasksCompleted += 1
    })

    const subjectsStudied = Object.values(subjectMap)

    // check if today's analytics already exists
    // if yes update it, if no create it
    // this is called upsert (update + insert)
    const analytics = await Analytics.findOneAndUpdate(
      { user: req.user.id, date: today },
      {
        user: req.user.id,
        date: today,
        dayName: DAYS[today.getDay()],
        hoursStudied: totalHours,
        tasksCompleted: completedTasks.length,
        totalTasks: todayPlan.tasks.length,
        subjectsStudied,
        streakDay: completedTasks.length > 0
      },
      { upsert: true, new: true }
    )

    res.status(200).json({
      message: 'Session logged ✅',
      analytics
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 2. GET WEEKLY ANALYTICS
// Returns last 7 days of study data
// Frontend uses this for the bar chart
// ─────────────────────────────────────────
export const getWeeklyAnalytics = async (req, res) => {
  try {
    // get last 7 days
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    // get analytics records for last 7 days
    const records = await Analytics.find({
      user: req.user.id,
      date: { $gte: sevenDaysAgo, $lte: today }
    }).sort({ date: 1 })

    // build a full 7-day array
    // even if student didn't study some days, show 0
    const week = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      // find if there's a record for this day
      const record = records.find(r => {
        const rDate = new Date(r.date)
        rDate.setHours(0, 0, 0, 0)
        return rDate.getTime() === date.getTime()
      })

      week.push({
        day: DAYS[date.getDay()],
        date: date.toISOString().split('T')[0],
        hoursStudied: record ? record.hoursStudied : 0,
        tasksCompleted: record ? record.tasksCompleted : 0,
        totalTasks: record ? record.totalTasks : 0
      })
    }

    // total for the week
    const totalHoursThisWeek = week.reduce((sum, d) => sum + d.hoursStudied, 0)
    const totalTasksThisWeek = week.reduce((sum, d) => sum + d.tasksCompleted, 0)

    res.status(200).json({
      week,
      totalHoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
      totalTasksThisWeek
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 3. GET SUMMARY
// Overall stats, best subject, weakest subject
// streak information
// ─────────────────────────────────────────
export const getSummary = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })
    const subjects = await Subject.find({ user: req.user.id })

    // ── STREAK ──
    // go through analytics records day by day
    // count consecutive days where streakDay = true
    const allRecords = await Analytics.find({
      user: req.user.id
    }).sort({ date: -1 })

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const record of allRecords) {
      const recordDate = new Date(record.date)
      recordDate.setHours(0, 0, 0, 0)

      if (recordDate > today) continue

      if (record.streakDay) {
        tempStreak++
        if (tempStreak > longestStreak) longestStreak = tempStreak
      } else {
        if (currentStreak === 0) currentStreak = tempStreak
        tempStreak = 0
      }
    }
    if (currentStreak === 0) currentStreak = tempStreak

    // ── BEST AND WEAKEST SUBJECT ──
    let bestSubject = null
    let weakestSubject = null

    if (studyPlan && subjects.length > 0) {
      const subjectProgress = subjects.map(subject => {
        const subjectTasks = studyPlan.schedule
          .flatMap(day => day.tasks)
          .filter(task => task.subject?.toString() === subject._id.toString())

        const total = subjectTasks.length
        const completed = subjectTasks.filter(t => t.isCompleted).length
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

        return {
          name: subject.name,
          color: subject.color,
          percentage
        }
      })

      // sort by percentage
      const sorted = [...subjectProgress].sort((a, b) => b.percentage - a.percentage)
      bestSubject = sorted[0] || null
      weakestSubject = sorted[sorted.length - 1] || null
    }

    // ── TOTAL HOURS ALL TIME ──
    const allAnalytics = await Analytics.find({ user: req.user.id })
    const totalHoursAllTime = allAnalytics.reduce((sum, a) => sum + a.hoursStudied, 0)
    const totalTasksCompleted = allAnalytics.reduce((sum, a) => sum + a.tasksCompleted, 0)

    res.status(200).json({
      streak: {
        current: currentStreak,
        longest: longestStreak,
        message: currentStreak > 0
          ? `${currentStreak} Day Study Streak 🔥`
          : 'Start studying to build your streak! 💪'
      },
      bestSubject,
      weakestSubject,
      totalHoursAllTime: Math.round(totalHoursAllTime * 10) / 10,
      totalTasksCompleted
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// ─────────────────────────────────────────
// 4. GET AI ANALYTICS PERFORMANCE INSIGHTS
// ─────────────────────────────────────────
export const getAnalyticsInsights = async (req, res) => {
  try {
    const subjects = await Subject.find({ user: req.user.id })
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    let subjectsContext = 'No subjects added yet.'

    if (subjects.length > 0 && studyPlan) {
      subjectsContext = subjects.map(s => {
        const daysLeft = Math.ceil((new Date(s.examDate) - new Date()) / (1000 * 60 * 60 * 24))
        const subTasks = studyPlan.schedule.flatMap(d => d.tasks).filter(t => t.subject?.toString() === s._id.toString())
        const completed = subTasks.filter(t => t.isCompleted).length
        const total = subTasks.length
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0
        return `${s.name}: Exam in ${daysLeft} days. Progress: ${completed}/${total} tasks completed (${pct}%, difficulty: ${s.difficulty})`
      }).join('\n')
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an advanced study performance analyst AI.
          Analyze the student's study plan progress and exams, and generate exactly 3 highly actionable, encouraging, and specific insights or study recommendations.
          
          Student progress context:
          ${subjectsContext}
          
          Return ONLY a JSON array containing exactly 3 strings (bullet points).
          Example output format:
          [
            "Your Math exam is in 5 days! Prioritize completing the remaining 3 chapters in your schedule.",
            "You are doing great in Physics (80% complete)! Spend an extra 30 minutes tutoring yourself on weak concepts to lock in a top grade.",
            "Consider shifting your heavier Mathematics study blocks to mornings, which align with your peak focus hours."
          ]
          Rules:
          - Each insight must be concise (maximum 2 sentences).
          - Be specific to the subjects and exam timelines provided.
          - Return ONLY the raw JSON array. No explanations, no markdown blocks, no prefix/suffix.`
        }
      ],
      max_tokens: 600
    })

    const responseText = completion.choices[0].message.content.trim()
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [
      "Keep studying consistently to build your study streak! 💪",
      "Prioritize subjects with closer exam dates to maximize revision buffers. 📅",
      "Check off completed tasks daily to trigger schedule adjustments. 🤖"
    ]

    res.status(200).json({
      message: 'Insights generated ✅',
      insights
    })

  } catch (error) {
    res.status(200).json({
      message: 'Using fallback insights due to load',
      insights: [
        "Keep studying consistently to build your study streak! 💪",
        "Prioritize subjects with closer exam dates to maximize revision buffers. 📅",
        "Check off completed tasks daily to trigger schedule adjustments. 🤖"
      ]
    })
  }
}