import Subject from '../models/Subject.js'
import StudyPlan from '../models/StudyPlan.js'

export const getProgress = async (req, res) => {
  try {
    const studyPlan = await StudyPlan.findOne({ user: req.user.id })

    if (!studyPlan) {
      return res.status(404).json({ message: 'No study plan found. Generate one first.' })
    }

    // get all subjects
    const subjects = await Subject.find({ user: req.user.id })

    // for each subject calculate progress
    const progress = subjects.map(subject => {
      // collect all tasks belonging to this subject from the schedule
      const subjectTasks = studyPlan.schedule
        .flatMap(day => day.tasks)
        .filter(task => task.subject?.toString() === subject._id.toString())

      const totalTasks = subjectTasks.length
      const completedTasks = subjectTasks.filter(t => t.isCompleted).length
      const percentage = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0

      // calculate hours
      const totalHours = subjectTasks.reduce((sum, t) => sum + t.estimatedHours, 0)
      const completedHours = subjectTasks
        .filter(t => t.isCompleted)
        .reduce((sum, t) => sum + t.estimatedHours, 0)

      // days until exam
      const daysRemaining = Math.ceil(
        (new Date(subject.examDate) - new Date()) / (1000 * 60 * 60 * 24)
      )

      return {
        subjectId: subject._id,
        subject: subject.name,
        color: subject.color,
        difficulty: subject.difficulty,
        examDate: subject.examDate,
        daysRemaining,
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        percentage,
        totalHours,
        completedHours
      }
    })

    // overall progress across all subjects
    const totalAllTasks = progress.reduce((sum, s) => sum + s.totalTasks, 0)
    const completedAllTasks = progress.reduce((sum, s) => sum + s.completedTasks, 0)
    const overall = totalAllTasks > 0
      ? Math.round((completedAllTasks / totalAllTasks) * 100)
      : 0

    res.status(200).json({
      progress,
      overall,
      summary: {
        totalSubjects: subjects.length,
        totalTasks: totalAllTasks,
        completedTasks: completedAllTasks,
        pendingTasks: totalAllTasks - completedAllTasks
      }
    })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}