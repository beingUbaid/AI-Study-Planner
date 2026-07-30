import cron from 'node-cron';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import StudyPlan from '../models/StudyPlan.js';
import sendEmail from './sendEmail.js';
import Lock from '../models/Lock.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import logger from './logger.js';
import { env } from '../config/env.js';

// Global variable tracking active delivery processes for graceful worker shutdowns
let activeDeliveriesCount = 0;

export const getActiveDeliveriesCount = () => activeDeliveriesCount;

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
    const durationMs = 60 * 60 * 1000; // 1 hour lock expiration

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
        activeDeliveriesCount++;
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

          // Stateful claims & retry logic
          const existingClaim = await NotificationDelivery.findOne({
            user: user._id,
            reminderType: 'exam_reminder',
            scheduledDate: todayStr
          });

          let shouldProcess = false;
          let logRecord = null;

          if (!existingClaim) {
            // 1. Fresh claim: try to insert atomically
            try {
              logRecord = await NotificationDelivery.create({
                user: user._id,
                reminderType: 'exam_reminder',
                scheduledDate: todayStr,
                status: 'claimed',
                attempts: 1,
                nextRetryAt: new Date(Date.now() + 10 * 60 * 1000) // claim expires in 10 minutes
              });
              shouldProcess = true;
            } catch {
              logger.info(`Claim race condition hit. Skipping run for user ${user._id}`);
            }
          } else {
            // 2. Recovery / Retry claims
            const isStaleClaim = existingClaim.status === 'claimed' && 
              (Date.now() - new Date(existingClaim.updatedAt).getTime() > 10 * 60 * 1000);
            const isReadyRetry = existingClaim.status === 'failed' && 
              existingClaim.attempts < 3 && 
              new Date(existingClaim.nextRetryAt) <= now;

            if (isStaleClaim || isReadyRetry) {
              logRecord = await NotificationDelivery.findOneAndUpdate(
                {
                  _id: existingClaim._id,
                  status: existingClaim.status,
                  attempts: existingClaim.attempts
                },
                {
                  status: 'claimed',
                  attempts: existingClaim.attempts + 1,
                  nextRetryAt: new Date(Date.now() + 10 * 60 * 1000)
                },
                { new: true }
              );
              if (logRecord) {
                shouldProcess = true;
              }
            }
          }

          if (!shouldProcess || !logRecord) {
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
                <a href="${env.CLIENT_URL}" 
                   style="background:#667eea; color:white; padding:12px 24px; 
                          border-radius:8px; text-decoration:none;">
                  Study Now 🚀
                </a>
              `
            );

            logRecord.status = 'sent';
            logRecord.lastError = null;
            await logRecord.save();
            logger.info('Daily exam reminder email sent and recorded successfully');
          } catch (sendErr) {
            logRecord.status = 'failed';
            logRecord.lastError = sendErr.message; // message contains error type (no PII)
            // Exponential backoff retry interval
            const retryDelayMs = logRecord.attempts * 5 * 60 * 1000; 
            logRecord.nextRetryAt = new Date(Date.now() + retryDelayMs);
            await logRecord.save();
            logger.error(`Failed sending daily reminder email: ${sendErr.message}`);
          }

        } catch (innerUserErr) {
          logger.error(`Error processing reminder loop for single user: ${innerUserErr.message}`);
        } finally {
          activeDeliveriesCount--;
        }
      }

    } catch (error) {
      logger.error('Cron job reminder execution error:', { error: error.message });
    }
  });

  logger.info('✅ Cron jobs started!');
  return [reminderJob];
};