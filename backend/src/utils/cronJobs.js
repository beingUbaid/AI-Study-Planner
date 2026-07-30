import cron from 'node-cron';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import StudyPlan from '../models/StudyPlan.js';
import sendEmail from './sendEmail.js';
import Lock from '../models/Lock.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import logger from './logger.js';

export const startCronJobs = () => {

  // ─────────────────────────────────────────
  // EXAM REMINDER
  // Runs every day at 8:00 AM
  // '0 8 * * *' means: minute=0, hour=8, every day
  // ─────────────────────────────────────────
  const reminderJob = cron.schedule('0 8 * * *', async () => {
    logger.info('⏰ Running exam reminder cron job...');

    const todayStr = new Date().toISOString().split('T')[0];
    const lockKey = `exam-reminder:${todayStr}`;
    const durationMs = 60 * 60 * 1000; // 1 hour expiration

    try {
      // Try to acquire distributed lock for this day
      const expireAt = new Date(Date.now() + durationMs);
      await Lock.create({ key: lockKey, expireAt });
      logger.info(`Lock acquired for ${lockKey}. Executing cron job.`);
    } catch {
      logger.info(`Cron job skip: lock for ${lockKey} already held by another worker instance.`);
      return;
    }

    try {
      // get all verified users
      const users = await User.find({ isVerified: true });

      for (const user of users) {
        try {
          // get their subjects with exams in next 3 days
          const now = new Date();
          const threeDaysLater = new Date();
          threeDaysLater.setDate(threeDaysLater.getDate() + 3);

          const urgentSubjects = await Subject.find({
            user: user._id,
            examDate: { $gte: now, $lte: threeDaysLater }
          });

          if (urgentSubjects.length === 0) {
            continue;
          }

          // Atomically check or claim the reminder task for this user today using NotificationDelivery
          let logRecord;
          try {
            logRecord = await NotificationDelivery.create({
              user: user._id,
              subject: null,
              task: null,
              reminderType: 'exam_reminder',
              scheduledDate: todayStr,
              status: 'claimed',
              attempts: 1
            });
          } catch {
            // Already sent or claimed
            logger.info(`Reminder already claimed or processed for user ${user._id} on ${todayStr}`);
            continue;
          }

          try {
            // get their pending tasks
            const studyPlan = await StudyPlan.findOne({ user: user._id });
            let pendingCount = 0;

            if (studyPlan) {
              const allTasks = studyPlan.schedule.flatMap(d => d.tasks);
              pendingCount = allTasks.filter(t => !t.isCompleted).length;
            }

            // build email content
            const subjectList = urgentSubjects.map(s => {
              const daysLeft = Math.ceil(
                (new Date(s.examDate) - now) / (1000 * 60 * 60 * 24)
              );
              return `<li><strong>${s.name}</strong> — in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</li>`;
            }).join('');

            // send reminder email
            await sendEmail(
              user.email,
              '⚠️ Exam Reminder — AI Study Planner',
              `
                <h2>Hello ${user.name}! 👋</h2>
                <p>You have upcoming exams very soon:</p>
                <ul>${subjectList}</ul>
                ${pendingCount > 0
                  ? `<p>You still have <strong>${pendingCount} pending tasks</strong>. Don't wait! 💪</p>`
                  : '<p>Great job! All tasks completed! 🎉</p>'
                }
                <p>Log in now and keep studying!</p>
                <a href="${process.env.CLIENT_URL}" 
                   style="background:#667eea; color:white; padding:12px 24px; 
                          border-radius:8px; text-decoration:none;">
                  Study Now 🚀
                </a>
              `
            );

            logRecord.status = 'sent';
            await logRecord.save();
            logger.info('Daily exam reminder email sent and recorded successfully');
          } catch (sendErr) {
            logRecord.status = 'failed';
            logRecord.lastError = sendErr.message;
            logRecord.attempts += 1;
            await logRecord.save();
            logger.error(`Failed sending daily reminder email: ${sendErr.message}`);
          }

        } catch (innerUserErr) {
          logger.error(`Error processing reminder loop for single user: ${innerUserErr.message}`);
        }
      }

    } catch (error) {
      logger.error('Cron job reminder execution error:', { error: error.message });
    }
  });

  logger.info('✅ Cron jobs started!');
  return [reminderJob];
};