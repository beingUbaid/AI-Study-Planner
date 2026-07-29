/**
 * Advanced Rescheduling Rebalancer
 * Collects incomplete tasks from past dates and redistributes them into future days,
 * appending reasons and maintaining daily workloads.
 */
export const rebalanceStudyPlan = (studyPlan, today) => {
  const missedTasks = [];

  // 1. Collect uncompleted tasks from past days
  studyPlan.schedule.forEach(day => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);

    if (dayDate < today) {
      const uncompleted = day.tasks.filter(t => !t.isCompleted);
      
      // Update reason to track rescheduling telemetry
      uncompleted.forEach(task => {
        const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        task.reason = `${task.reason || ''} [Shifted from missed day: ${dateStr}]`.trim();
      });

      missedTasks.push(...uncompleted);
      
      // Keep only completed tasks in past days
      day.tasks = day.tasks.filter(t => t.isCompleted);
      day.totalHours = day.tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
    }
  });

  if (missedTasks.length === 0) {
    return { rescheduledCount: 0, missedTasks };
  }

  // 2. Redistribute missed tasks into today and future days
  let missedIdx = 0;
  studyPlan.schedule.forEach(day => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);

    if (dayDate >= today && !day.isBreakDay && missedIdx < missedTasks.length) {
      const currentHours = day.tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
      
      // Determine dynamic limit:
      // If the upcoming task has an examDate and it's within 2 days of this day, allow up to 8 hours
      const nextTask = missedTasks[missedIdx];
      const examDate = nextTask.examDate ? new Date(nextTask.examDate) : null;
      let dailyLimit = studyPlan.dailyStudyHours || 4;
      
      if (examDate) {
        examDate.setHours(0, 0, 0, 0);
        const daysToExam = Math.ceil((examDate - dayDate) / (1000 * 60 * 60 * 24));
        if (daysToExam <= 2 && daysToExam >= 0) {
          dailyLimit = 8; // Compressed high-intensity study limit
        }
      }

      let availableHours = Math.max(0, dailyLimit - currentHours);

      while (missedIdx < missedTasks.length && availableHours > 0) {
        const taskToMove = missedTasks[missedIdx];
        
        // Ensure task has estimate
        const est = taskToMove.estimatedHours || 1;
        if (availableHours >= est || day.tasks.length === 0) { // Always allow at least one task per day to prevent blocking
          day.tasks.push(taskToMove);
          availableHours -= est;
          missedIdx++;
        } else {
          break; // Doesn't fit, move to next day
        }
      }

      day.totalHours = day.tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
    }
  });

  // 3. If any missed tasks remain, append new day(s) at the end
  if (missedIdx < missedTasks.length) {
    const lastDay = studyPlan.schedule[studyPlan.schedule.length - 1];
    const lastDate = new Date(lastDay.date);

    while (missedIdx < missedTasks.length) {
      lastDate.setDate(lastDate.getDate() + 1);
      const newDayTasks = [];
      let hoursUsed = 0;

      while (missedIdx < missedTasks.length && hoursUsed < studyPlan.dailyStudyHours) {
        const taskToMove = missedTasks[missedIdx];
        newDayTasks.push(taskToMove);
        hoursUsed += (taskToMove.estimatedHours || 1);
        missedIdx++;
      }

      studyPlan.schedule.push({
        date: new Date(lastDate),
        dayName: lastDate.toLocaleDateString('en-US', { weekday: 'long' }),
        tasks: newDayTasks,
        totalHours: hoursUsed,
        isBreakDay: false
      });
    }
  }

  return {
    rescheduledCount: missedTasks.length,
    missedTasks
  };
};
