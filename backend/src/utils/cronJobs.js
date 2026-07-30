import cron from 'node-cron';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import StudyPlan from '../models/StudyPlan.js';
import sendEmail from './sendEmail.js';
import Lock from '../models/Lock.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import logger from './logger.js';
import { env } from '../config/env.js';

const CLAIM_TTL_MS = 10 * 60 * 1000;   // 10 minutes: how long a claim is valid before recovery
const MAX_ATTEMPTS  = 3;                // maximum delivery attempts before giving up

// Track active in-flight delivery processes so the worker can drain cleanly on SIGTERM
let _activeDeliveriesCount = 0;
export const getActiveDeliveriesCount = () => _activeDeliveriesCount;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED CORE HANDLER — fully testable without a live cron schedule
// ─────────────────────────────────────────────────────────────────────────────
export async function runExamReminders() {
  logger.info('⏰ Running exam reminder handler...');

  const todayStr = new Date().toISOString().split('T')[0];
  const lockKey  = `exam-reminder:${todayStr}`;
  const now      = new Date();

  // ── 1. Acquire a distributed lock so only one worker pod processes today's reminders ──
  try {
    const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour lock TTL
    await Lock.create({ key: lockKey, expireAt });
    logger.info(`Distributed lock acquired for ${lockKey}`);
  } catch {
    logger.info(`Reminder skip: lock "${lockKey}" already held by another worker.`);
    return;
  }

  // ── 2. Fetch all verified users ──
  let users;
  try {
    users = await User.find({ isVerified: true }).lean();
  } catch (err) {
    logger.error('Failed to fetch users for reminder job', { error: err.message });
    return;
  }

  for (const user of users) {
    _activeDeliveriesCount++;
    try {
      await _processUserReminder(user, todayStr, now);
    } catch (err) {
      logger.error('Unhandled error in per-user reminder loop', { error: err.message });
    } finally {
      _activeDeliveriesCount--;
    }
  }

  logger.info('⏰ Exam reminder handler finished.');
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-USER DELIVERY LOGIC
// ─────────────────────────────────────────────────────────────────────────────
async function _processUserReminder(user, todayStr, now) {
  // Check for upcoming exams in the next 3 days
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const urgentSubjects = await Subject.find({
    user: user._id,
    examDate: { $gte: now, $lte: threeDaysLater }
  }).lean();

  if (urgentSubjects.length === 0) return; // nothing to do

  // ── Atomic claim / stale-recovery / retry logic ──
  const claimExpiresAt = new Date(Date.now() + CLAIM_TTL_MS);
  let deliveryRecord = null;

  // Try fresh insert (will fail with duplicate-key if record already exists)
  try {
    deliveryRecord = await NotificationDelivery.create({
      user:           user._id,
      reminderType:   'exam_reminder',
      scheduledDate:  todayStr,
      status:         'claimed',
      attempts:       1,
      claimedAt:      now,
      claimExpiresAt
    });
  } catch (_) {
    // Record already exists — check whether we should recover or skip
    const existing = await NotificationDelivery.findOne({
      user: user._id, reminderType: 'exam_reminder', scheduledDate: todayStr
    });
    if (!existing) return; // unexpected — skip

    const isStaleClaim = existing.status === 'claimed' && existing.claimExpiresAt < now;
    const isRetryable  = existing.status === 'failed'  &&
                         existing.attempts < MAX_ATTEMPTS &&
                         existing.nextRetryAt <= now;

    if (!isStaleClaim && !isRetryable) {
      // Already sent, or actively claimed, or not yet retry-eligible
      return;
    }

    // Atomic findOneAndUpdate — prevents two workers racing to recover the same record
    deliveryRecord = await NotificationDelivery.findOneAndUpdate(
      {
        _id:      existing._id,
        status:   existing.status,  // optimistic concurrency: must still be in the expected state
        attempts: existing.attempts
      },
      {
        $set: {
          status:         'claimed',
          claimedAt:      now,
          claimExpiresAt,
          attempts:       existing.attempts + 1
        }
      },
      { new: true }
    );

    if (!deliveryRecord) {
      // Another worker won the race — skip
      return;
    }
  }

  // ── Send the email ──
  try {
    const studyPlan  = await StudyPlan.findOne({ user: user._id }).lean();
    let pendingCount = 0;
    if (studyPlan) {
      const allTasks = studyPlan.schedule.flatMap(d => d.tasks);
      pendingCount   = allTasks.filter(t => !t.isCompleted).length;
    }

    const subjectList = urgentSubjects.map(s => {
      const daysLeft = Math.ceil((new Date(s.examDate) - now) / (1000 * 60 * 60 * 24));
      return `<li><strong>${s.name}</strong> — in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</li>`;
    }).join('');

    await sendEmail(
      user.email,
      '⚠️ Exam Reminder — AI Study Planner',
      `<h2>Hello ${user.name}! 👋</h2>
       <p>You have upcoming exams very soon:</p>
       <ul>${subjectList}</ul>
       ${pendingCount > 0
         ? `<p>You still have <strong>${pendingCount} pending tasks</strong>. Don't wait! 💪</p>`
         : '<p>Great job! All tasks completed! 🎉</p>'}
       <p>Log in now and keep studying!</p>
       <a href="${env.CLIENT_URL}"
          style="background:#667eea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">
         Study Now 🚀
       </a>`
    );

    await NotificationDelivery.updateOne(
      { _id: deliveryRecord._id },
      { $set: { status: 'sent', sentAt: new Date(), lastError: null } }
    );
    logger.info('Exam reminder sent successfully', { userId: String(user._id) });

  } catch (sendErr) {
    // Sanitize error: log only message type — never log user.email or other PII
    const safeError = sendErr.code || sendErr.message?.substring(0, 120) || 'SMTP_ERROR';
    const backoffMs = Math.min(deliveryRecord.attempts * 5 * 60 * 1000, 60 * 60 * 1000);

    await NotificationDelivery.updateOne(
      { _id: deliveryRecord._id },
      {
        $set: {
          status:      'failed',
          lastError:   safeError,
          nextRetryAt: new Date(Date.now() + backoffMs)
        }
      }
    );
    logger.error('Failed to send exam reminder', { error: safeError, attempt: deliveryRecord.attempts });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON WRAPPER — schedules the exported handler; returns job handles for shutdown
// ─────────────────────────────────────────────────────────────────────────────
export function startCronJobs() {
  const reminderJob = cron.schedule('0 8 * * *', runExamReminders, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('✅ Cron jobs started (exam reminder @ 08:00 UTC daily)');
  return [reminderJob];
}