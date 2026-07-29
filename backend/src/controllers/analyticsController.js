import Analytics from '../models/Analytics.js';
import Subject from '../models/Subject.js';
import StudyPlan from '../models/StudyPlan.js';
import * as aiService from '../services/aiService.js';
import { catchAsync } from '../middleware/errorMiddleware.js';
import AppError from '../utils/appError.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─────────────────────────────────────────
// 1. LOG TODAY'S STUDY SESSION
// ─────────────────────────────────────────
export const logTodaySession = catchAsync(async (req, res, next) => {
  const studyPlan = await StudyPlan.findOne({ user: req.user.id });
  if (!studyPlan) {
    return next(new AppError('No study plan found to log progress.', 404));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's entry in the schedule
  const todayPlan = studyPlan.schedule.find(day => {
    const d = new Date(day.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  if (!todayPlan) {
    return res.status(200).json({
      status: 'success',
      message: 'No tasks scheduled for today. Nothing to log.'
    });
  }

  const completedTasks = todayPlan.tasks.filter(t => t.isCompleted);
  const totalHours = completedTasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);

  // Group stats by subject
  const subjectMap = {};
  completedTasks.forEach(task => {
    if (!subjectMap[task.subjectName]) {
      subjectMap[task.subjectName] = {
        subjectName: task.subjectName,
        subjectColor: task.subjectColor,
        hoursStudied: 0,
        tasksCompleted: 0
      };
    }
    subjectMap[task.subjectName].hoursStudied += (task.estimatedHours || 1);
    subjectMap[task.subjectName].tasksCompleted += 1;
  });

  const subjectsStudied = Object.values(subjectMap);

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
  );

  res.status(200).json({
    status: 'success',
    message: 'Session progress logged ✅',
    analytics
  });
});

// ─────────────────────────────────────────
// 2. GET WEEKLY ANALYTICS
// ─────────────────────────────────────────
export const getWeeklyAnalytics = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const records = await Analytics.find({
    user: req.user.id,
    date: { $gte: sevenDaysAgo, $lte: today }
  }).sort({ date: 1 });

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const record = records.find(r => {
      const rDate = new Date(r.date);
      rDate.setHours(0, 0, 0, 0);
      return rDate.getTime() === date.getTime();
    });

    week.push({
      day: DAYS[date.getDay()],
      date: date.toISOString().split('T')[0],
      hoursStudied: record ? record.hoursStudied : 0,
      tasksCompleted: record ? record.tasksCompleted : 0,
      totalTasks: record ? record.totalTasks : 0
    });
  }

  const totalHoursThisWeek = week.reduce((sum, d) => sum + d.hoursStudied, 0);
  const totalTasksThisWeek = week.reduce((sum, d) => sum + d.tasksCompleted, 0);

  res.status(200).json({
    status: 'success',
    week,
    totalHoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
    totalTasksThisWeek
  });
});

// ─────────────────────────────────────────
// 3. GET SUMMARY (Streaks, Mastery, Forecast, Burnout)
// ─────────────────────────────────────────
export const getSummary = catchAsync(async (req, res, next) => {
  const studyPlan = await StudyPlan.findOne({ user: req.user.id });
  const subjects = await Subject.find({ user: req.user.id });

  // ── 3.1. STREAK CALCULATION ──
  const allRecords = await Analytics.find({ user: req.user.id }).sort({ date: -1 });

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if streak was active yesterday or today
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const record of allRecords) {
    const recordDate = new Date(record.date);
    recordDate.setHours(0, 0, 0, 0);

    if (recordDate > today) continue;

    if (record.streakDay) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      if (currentStreak === 0) currentStreak = tempStreak;
      tempStreak = 0;
    }
  }
  if (currentStreak === 0) currentStreak = tempStreak;

  // Verify streak breaks if no activity today or yesterday
  const hasActivityRecently = allRecords.some(r => {
    const rDate = new Date(r.date);
    rDate.setHours(0, 0, 0, 0);
    return (rDate.getTime() === today.getTime() || rDate.getTime() === yesterday.getTime()) && r.streakDay;
  });
  if (!hasActivityRecently) {
    currentStreak = 0;
  }

  // ── 3.2. SUBJECT MASTERY TRACKING ──
  const subjectMastery = [];
  let bestSubject = null;
  let weakestSubject = null;

  if (studyPlan && subjects.length > 0) {
    subjects.forEach(subject => {
      const subjectTasks = studyPlan.schedule
        .flatMap(day => day.tasks)
        .filter(task => task.subject?.toString() === subject._id.toString());

      const total = subjectTasks.length;
      const completed = subjectTasks.filter(t => t.isCompleted).length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      // Quiz average
      const quizScores = subject.quizPerformance.map(q => q.score);
      const avgQuizScore = quizScores.length > 0
        ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
        : null;

      // Mastery formula: 60% Quiz score, 40% completion rate (or 100% completion if no quiz score)
      let masteryScore = 0;
      if (avgQuizScore !== null) {
        masteryScore = (avgQuizScore * 0.6) + (completionRate * 0.4);
      } else {
        masteryScore = completionRate;
      }
      masteryScore = Math.round(masteryScore);

      subjectMastery.push({
        name: subject.name,
        color: subject.color,
        mastery: masteryScore,
        completionRate: Math.round(completionRate),
        quizAverage: avgQuizScore ? Math.round(avgQuizScore) : null
      });
    });

    const sortedByMastery = [...subjectMastery].sort((a, b) => b.mastery - a.mastery);
    bestSubject = sortedByMastery[0] || null;
    weakestSubject = sortedByMastery[sortedByMastery.length - 1] || null;
  }

  // ── 3.3. COMPLETION FORECASTING & VELOCITY ──
  const allAnalytics = await Analytics.find({ user: req.user.id });
  const totalHoursAllTime = allAnalytics.reduce((sum, a) => sum + a.hoursStudied, 0);
  const totalTasksCompleted = allAnalytics.reduce((sum, a) => sum + a.tasksCompleted, 0);

  // Velocity = Average hours studied per day on active study days
  const activeDays = allAnalytics.filter(a => a.hoursStudied > 0).length;
  const studyVelocity = activeDays > 0 ? totalHoursAllTime / activeDays : (studyPlan?.dailyStudyHours || 3);

  // Calculate remaining workload
  let remainingHours = 0;
  let completionForecastDate = null;

  if (studyPlan) {
    const allRemainingTasks = studyPlan.schedule
      .filter(day => {
        const d = new Date(day.date);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .flatMap(day => day.tasks)
      .filter(t => !t.isCompleted);

    remainingHours = allRemainingTasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);

    if (studyVelocity > 0 && remainingHours > 0) {
      const daysRequired = Math.ceil(remainingHours / studyVelocity);
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + daysRequired);
      completionForecastDate = forecastDate;
    }
  }

  // ── 3.4. BURNOUT RISK METRICS ──
  let burnoutRisk = 'Low';
  let burnoutMessage = 'Workload density is well balanced.';
  if (studyPlan) {
    const next7Days = studyPlan.schedule.filter(day => {
      const d = new Date(day.date);
      d.setHours(0, 0, 0, 0);
      return d >= today && d <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    });

    const heavyDays = next7Days.filter(d => d.totalHours >= 6).length;
    const extremeDays = next7Days.filter(d => d.totalHours >= 8).length;

    if (extremeDays > 0 || heavyDays >= 4) {
      burnoutRisk = 'High';
      burnoutMessage = 'High volume of intense study blocks scheduled. Burnout risk detected.';
    } else if (heavyDays >= 2) {
      burnoutRisk = 'Medium';
      burnoutMessage = 'Workload is elevated. Monitor your focus and take regular micro-breaks.';
    }
  }

  res.status(200).json({
    status: 'success',
    streak: {
      current: currentStreak,
      longest: longestStreak,
      message: currentStreak > 0
        ? `${currentStreak} Day Study Streak 🔥`
        : 'Start studying to build your streak! 💪'
    },
    subjectMastery,
    bestSubject,
    weakestSubject,
    totalHoursAllTime: Math.round(totalHoursAllTime * 10) / 10,
    totalTasksCompleted,
    burnout: {
      risk: burnoutRisk,
      message: burnoutMessage
    },
    forecasting: {
      velocity: Math.round(studyVelocity * 10) / 10,
      remainingHours,
      forecastedCompletionDate: completionForecastDate
    }
  });
});

// ─────────────────────────────────────────
// 4. GET AI PERFORMANCE INSIGHTS
// ─────────────────────────────────────────
export const getAnalyticsInsights = catchAsync(async (req, res, next) => {
  const subjects = await Subject.find({ user: req.user.id });
  const studyPlan = await StudyPlan.findOne({ user: req.user.id });

  let subjectsContext = 'No subjects added yet.';

  if (subjects.length > 0 && studyPlan) {
    subjectsContext = subjects.map(s => {
      const daysLeft = Math.ceil((new Date(s.examDate) - new Date()) / (1000 * 60 * 60 * 24));
      const subTasks = studyPlan.schedule.flatMap(d => d.tasks).filter(t => t.subject?.toString() === s._id.toString());
      const completed = subTasks.filter(t => t.isCompleted).length;
      const total = subTasks.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return `${s.name}: Exam in ${daysLeft} days. Progress: ${completed}/${total} tasks completed (${pct}%, difficulty: ${s.difficulty})`;
    }).join('\n');
  }

  const insights = await aiService.generatePlanExplanation(subjectsContext, studyPlan?.dailyStudyHours || 3, studyPlan?.schedule?.length || 0);

  // Split raw bullet response from ai into list if string format, or return array
  const formattedInsights = typeof insights === 'string'
    ? insights.split('\n').filter(line => line.trim().length > 0).map(line => line.replace(/^-\s*/, '').replace(/^\*\s*/, ''))
    : insights;

  res.status(200).json({
    status: 'success',
    insights: formattedInsights
  });
});