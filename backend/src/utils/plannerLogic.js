const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const generateSchedule = (subjects, dailyStudyHours, startDate) => {
  const schedule = []
  const currentDate = new Date(startDate)
 
  const sortedSubjects = [...subjects].sort((a, b) => 
    new Date(a.examDate) - new Date(b.examDate)
  )


  const allTasks = []

  for (const subject of sortedSubjects) {
    const examDate = new Date(subject.examDate)
    const today = new Date(startDate)
    const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24))


    for (const chapter of subject.chapters) {
      allTasks.push({
        subject: subject.subjectId,
        subjectName: subject.name,
        subjectColor: subject.color,
        chapter: chapter._id,
        chapterName: chapter.name,
        estimatedHours: chapter.estimatedHours || 1,
        isRevision: false,
        examDate,
        daysUntilExam
      })
    }

    allTasks.push({
      subject: subject.subjectId,
      subjectName: subject.name,
      subjectColor: subject.color,
      chapterName: `Revision — ${subject.name}`,
      estimatedHours: 1.5,
      isRevision: true,
      examDate,
      daysUntilExam
    })
  }


  let taskIndex = 0
  let dayCount = 0

  while (taskIndex < allTasks.length) {
    const date = new Date(currentDate)
    date.setDate(date.getDate() + dayCount)

    const dayName = DAYS[date.getDay()]

    // every 7th day is a break day
    if (dayCount > 0 && dayCount % 7 === 0) {
      schedule.push({
        date: new Date(date),
        dayName,
        tasks: [],
        totalHours: 0,
        isBreakDay: true
      })
      dayCount++
      continue
    }

    // fill this day with tasks
    const dayTasks = []
    let hoursUsed = 0

    while (taskIndex < allTasks.length) {
      const task = allTasks[taskIndex]
      
      // check if adding this task exceeds daily limit
      if (hoursUsed + task.estimatedHours > dailyStudyHours) {
        break
      }

      dayTasks.push(task)
      hoursUsed += task.estimatedHours
      taskIndex++
    }

    if (dayTasks.length > 0) {
      schedule.push({
        date: new Date(date),
        dayName,
        tasks: dayTasks,
        totalHours: hoursUsed,
        isBreakDay: false
      })
    }

    dayCount++
  }

  return schedule
}


export const detectBurnout = (schedule, dailyStudyHours) => {
  if (dailyStudyHours >= 8) {
    return {
      hasBurnoutRisk: true,
      message: 'Your schedule is very intense! Consider reducing to 4-6 hours/day and adding more break days.'
    }
  }

  let heavyDaysInRow = 0
  for (const day of schedule) {
    if (day.totalHours >= 6) {
      heavyDaysInRow++
    } else {
      heavyDaysInRow = 0
    }
    if (heavyDaysInRow >= 5) {
      return {
        hasBurnoutRisk: true,
        message: 'You have 5+ heavy study days in a row. Consider adding a break day!'
      }
    }
  }

  return { hasBurnoutRisk: false, message: null }
}