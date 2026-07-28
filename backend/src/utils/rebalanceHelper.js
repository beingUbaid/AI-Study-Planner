/**
 * Algorithmic rebalancing helper.
 * Redistributes uncompleted tasks from past days into today and future days
 * without exceeding the daily study hours limit, or appends new days if needed.
 * 
 * @param {Object} studyPlan - The Mongoose StudyPlan document
 * @param {Date} today - Date object for today at midnight
 * @returns {Object} { rescheduledCount, missedTasks }
 */
export const rebalanceStudyPlan = (studyPlan, today) => {
  const missedTasks = []

  // 1. Collect uncompleted tasks from past days
  studyPlan.schedule.forEach(day => {
    const dayDate = new Date(day.date)
    dayDate.setHours(0, 0, 0, 0)

    if (dayDate < today) {
      const uncompleted = day.tasks.filter(t => !t.isCompleted)
      missedTasks.push(...uncompleted)
      // Keep only completed tasks in past days
      day.tasks = day.tasks.filter(t => t.isCompleted)
      day.totalHours = day.tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0)
    }
  })

  if (missedTasks.length === 0) {
    return { rescheduledCount: 0, missedTasks }
  }

  // 2. Redistribute missed tasks into today and future days
  let missedIdx = 0
  studyPlan.schedule.forEach(day => {
    const dayDate = new Date(day.date)
    dayDate.setHours(0, 0, 0, 0)

    if (dayDate >= today && !day.isBreakDay && missedIdx < missedTasks.length) {
      const currentHours = day.tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0)
      let availableHours = Math.max(0, studyPlan.dailyStudyHours - currentHours)

      while (missedIdx < missedTasks.length && availableHours > 0) {
        const taskToMove = missedTasks[missedIdx]
        day.tasks.push(taskToMove)
        availableHours -= (taskToMove.estimatedHours || 1)
        missedIdx++
      }

      day.totalHours = day.tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0)
    }
  })

  // 3. If any missed tasks remain, append new day(s) at the end
  if (missedIdx < missedTasks.length) {
    const lastDay = studyPlan.schedule[studyPlan.schedule.length - 1]
    const lastDate = new Date(lastDay.date)

    while (missedIdx < missedTasks.length) {
      lastDate.setDate(lastDate.getDate() + 1)
      const newDayTasks = []
      let hoursUsed = 0

      while (missedIdx < missedTasks.length && hoursUsed < studyPlan.dailyStudyHours) {
        const taskToMove = missedTasks[missedIdx]
        newDayTasks.push(taskToMove)
        hoursUsed += (taskToMove.estimatedHours || 1)
        missedIdx++
      }

      studyPlan.schedule.push({
        date: new Date(lastDate),
        dayName: lastDate.toLocaleDateString('en-US', { weekday: 'long' }),
        tasks: newDayTasks,
        totalHours: hoursUsed,
        isBreakDay: false
      })
    }
  }

  return {
    rescheduledCount: missedTasks.length,
    missedTasks
  }
}
