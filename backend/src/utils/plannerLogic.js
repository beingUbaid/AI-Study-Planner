const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Advanced Production-Grade Scheduling Engine
 * Integrates:
 * 1. Spaced Repetition (Leitner system stages based on quiz performance)
 * 2. Prerequisite & Topic Dependency checks
 * 3. Exam proximity prioritization
 * 4. Explainable AI decision logs
 */
export const generateSchedule = (subjects, dailyStudyHours, startDate) => {
  const schedule = [];
  const currentDate = new Date(startDate);

  // Helper to extract average score
  const getAverageQuizScore = (subj) => {
    if (!subj.quizPerformance || subj.quizPerformance.length === 0) return null;
    const total = subj.quizPerformance.reduce((sum, q) => sum + q.score, 0);
    return total / subj.quizPerformance.length;
  };

  // Determine Leitner Box Stage (1 to 5) and multiplier based on quiz performance
  const getLeitnerMetrics = (subj) => {
    const avgScore = getAverageQuizScore(subj);
    if (avgScore === null) return { stage: 1, multiplier: 1.0, label: 'Unstarted' };
    if (avgScore < 50) return { stage: 1, multiplier: 1.3, label: 'Needs Focus' };
    if (avgScore < 70) return { stage: 2, multiplier: 1.15, label: 'Reviewing' };
    if (avgScore < 85) return { stage: 3, multiplier: 1.0, label: 'Proficient' };
    if (avgScore < 95) return { stage: 4, multiplier: 0.8, label: 'Advanced' };
    return { stage: 5, multiplier: 0.5, label: 'Mastered' }; // Mastered: cut time in half
  };

  // 1. Sort subjects by priority: closer exam dates and weak performance first
  const sortedSubjects = [...subjects].sort((a, b) => {
    const avgA = getAverageQuizScore(a);
    const avgB = getAverageQuizScore(b);

    let dateWeightA = a.examDate ? new Date(a.examDate).getTime() : Infinity;
    let dateWeightB = b.examDate ? new Date(b.examDate).getTime() : Infinity;

    // Shift date weight closer (priority boost) if scores are weak (< 70)
    if (avgA !== null && avgA < 70) dateWeightA -= 4 * 24 * 60 * 60 * 1000; // 4 days boost
    if (avgB !== null && avgB < 70) dateWeightB -= 4 * 24 * 60 * 60 * 1000;

    // Shift date weight further away (lower priority) if mastered
    if (avgA !== null && avgA >= 90) dateWeightA += 3 * 24 * 60 * 60 * 1000;
    if (avgB !== null && avgB >= 90) dateWeightB += 3 * 24 * 60 * 60 * 1000;

    return dateWeightA - dateWeightB;
  });

  const allTasks = [];

  // 2. Queue chapters in order, resolving topic dependencies
  for (const subject of sortedSubjects) {
    const examDate = subject.examDate ? new Date(subject.examDate) : null;
    const todayDate = new Date(startDate);
    const daysUntilExam = examDate ? Math.ceil((examDate - todayDate) / (1000 * 60 * 60 * 24)) : null;

    const { stage, multiplier, label } = getLeitnerMetrics(subject);
    const avgScore = getAverageQuizScore(subject);

    // Sort chapters by prerequisite logic:
    // If chapter B has chapter A as a prerequisite, chapter A must be scheduled first.
    // By default, chapters are ordered by the `order` index.
    const chapters = [...subject.chapters].sort((a, b) => {
      // If a is prerequisite of b, a comes first
      if (b.prerequisite && b.prerequisite.toString() === a._id.toString()) return -1;
      // If b is prerequisite of a, b comes first
      if (a.prerequisite && a.prerequisite.toString() === b._id.toString()) return 1;
      // Default to order index
      return (a.order || 0) - (b.order || 0);
    });

    for (const chapter of chapters) {
      // Calculate adjusted hours based on Leitner multiplier
      let hours = chapter.estimatedHours || 1;
      hours = Math.max(0.5, Math.round(hours * multiplier * 2) / 2); // round to nearest 0.5 hours

      // Generate explainable decision message
      let reason = `Leitner stage ${stage} (${label}) based on `;
      reason += avgScore !== null ? `quiz average of ${Math.round(avgScore)}%.` : 'no quiz history yet.';
      if (daysUntilExam !== null) {
        reason += ` Scheduled ahead of exam in ${daysUntilExam} days.`;
      }
      if (chapter.prerequisite) {
        reason += ` Scheduled after prerequisite check.`;
      }

      allTasks.push({
        subject: subject.subjectId,
        subjectName: subject.name,
        subjectColor: subject.color,
        chapter: chapter._id,
        chapterName: chapter.name,
        estimatedHours: hours,
        isRevision: false,
        reason,
        stage,
        examDate,
        daysUntilExam
      });
    }

    // Add spaced repetition revision sessions
    // Scale revision duration based on mastery: higher stage needs less revision
    if (stage < 5) {
      const revisionHours = Math.max(0.5, Math.round(1.5 * (1.2 - (stage * 0.15)) * 2) / 2);
      allTasks.push({
        subject: subject.subjectId,
        subjectName: subject.name,
        subjectColor: subject.color,
        chapterName: `Revision Buffer — ${subject.name}`,
        estimatedHours: revisionHours,
        isRevision: true,
        reason: `Spaced repetition buffer for ${subject.name} (Stage ${stage} review slot).`,
        stage,
        examDate,
        daysUntilExam
      });
    }
  }

  // 3. Distribute tasks into study days
  let taskIndex = 0;
  let dayCount = 0;

  while (taskIndex < allTasks.length) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + dayCount);

    const dayName = DAYS[date.getDay()];

    // Add rest/break days every 7 days to mitigate burnout
    if (dayCount > 0 && dayCount % 7 === 6) {
      schedule.push({
        date: new Date(date),
        dayName,
        tasks: [],
        totalHours: 0,
        isBreakDay: true
      });
      dayCount++;
      continue;
    }

    const dayTasks = [];
    let hoursUsed = 0;

    // Load tasks into the day until daily limit is reached
    while (taskIndex < allTasks.length) {
      const task = allTasks[taskIndex];
      
      // If adding this task exceeds daily limit, schedule on next day
      if (hoursUsed > 0 && hoursUsed + task.estimatedHours > dailyStudyHours) {
        break;
      }
      
      dayTasks.push(task);
      hoursUsed += task.estimatedHours;
      taskIndex++;
    }

    if (dayTasks.length > 0) {
      schedule.push({
        date: new Date(date),
        dayName,
        tasks: dayTasks,
        totalHours: hoursUsed,
        isBreakDay: false
      });
    }

    dayCount++;
  }

  return schedule;
};

/**
 * Evaluates scheduling data to detect burnout patterns and predict student exhaustion
 */
export const detectBurnout = (schedule, dailyStudyHours) => {
  if (dailyStudyHours >= 8) {
    return {
      hasBurnoutRisk: true,
      message: 'Critical Burnout Risk! A limit of 8+ study hours per day is unsustainable. We recommend lowering this to 4-6 hours.'
    };
  }

  let consecutiveHeavyDays = 0;
  for (const day of schedule) {
    if (day.totalHours >= 6) {
      consecutiveHeavyDays++;
    } else {
      consecutiveHeavyDays = 0;
    }
    
    if (consecutiveHeavyDays >= 4) {
      return {
        hasBurnoutRisk: true,
        message: 'High Workload Risk: You have 4 consecutive days with 6+ hours of study. Consider reducing daily limits or inserting a manual break.'
      };
    }
  }

  return { hasBurnoutRisk: false, message: null };
};