const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const generateSchedule = (subjects, dailyStudyHours, startDate) => {
  const schedule = []
  const currentDate = new Date(startDate)

  // Calculate average quiz score and priority weights
  const getAverageQuizScore = (subj) => {
    if (!subj.quizPerformance || subj.quizPerformance.length === 0) return null;
    const total = subj.quizPerformance.reduce((sum, q) => sum + q.score, 0);
    return total / subj.quizPerformance.length;
  };

  const sortedSubjects = [...subjects].sort((a, b) => {
    const avgA = getAverageQuizScore(a);
    const avgB = getAverageQuizScore(b);

    let dateWeightA = a.examDate ? new Date(a.examDate).getTime() : Infinity;
    let dateWeightB = b.examDate ? new Date(b.examDate).getTime() : Infinity;

    // Prioritize weak subjects (quiz score < 70) by pulling date weight closer (3 days)
    if (avgA !== null && avgA < 70) dateWeightA -= 3 * 24 * 60 * 60 * 1000;
    if (avgB !== null && avgB < 70) dateWeightB -= 3 * 24 * 60 * 60 * 1000;

    // Deprioritize mastered subjects (quiz score >= 85) by pushing date weight later
    if (avgA !== null && avgA >= 85) dateWeightA += 3 * 24 * 60 * 60 * 1000;
    if (avgB !== null && avgB >= 85) dateWeightB += 3 * 24 * 60 * 60 * 1000;

    return dateWeightA - dateWeightB;
  })

  const allTasks = []

  for (const subject of sortedSubjects) {
    const examDate = subject.examDate ? new Date(subject.examDate) : null
    const today = new Date(startDate)
    const daysUntilExam = examDate ? Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)) : null

    const avgScore = getAverageQuizScore(subject);
    const isMastered = avgScore !== null && avgScore >= 85;

    for (const chapter of subject.chapters) {
      // Scale down estimated hours for mastered subjects to avoid repetition overload
      let hours = chapter.estimatedHours || 1;
      if (isMastered) {
        hours = Math.max(1, Math.round(hours * 0.5));
      }

      allTasks.push({
        subject: subject.subjectId,
        subjectName: subject.name,
        subjectColor: subject.color,
        chapter: chapter._id,
        chapterName: chapter.name,
        estimatedHours: hours,
        isRevision: false,
        examDate,
        daysUntilExam
      })
    }

    // Skip adding standard revision block if subject is mastered
    if (!isMastered) {
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
  }

  let taskIndex = 0
  let dayCount = 0

  while (taskIndex < allTasks.length) {
    const date = new Date(currentDate)
    date.setDate(date.getDate() + dayCount)

    const dayName = DAYS[date.getDay()]

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

    const dayTasks = []
    let hoursUsed = 0

    while (taskIndex < allTasks.length) {
      const task = allTasks[taskIndex]
      if (hoursUsed > 0 && hoursUsed + task.estimatedHours > dailyStudyHours) break
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
      message: 'Your schedule is very intense! Consider reducing to 4-6 hours/day.'
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