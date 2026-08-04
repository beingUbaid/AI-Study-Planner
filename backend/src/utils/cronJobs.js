import cron from 'node-cron';
import crypto from 'crypto';
import { URL } from 'node:url';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import StudyPlan from '../models/StudyPlan.js';
import sendEmail from './sendEmail.js';
import Lock from '../models/Lock.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import logger from './logger.js';
import { env } from '../config/env.js';

const CLAIM_TTL_MS = 10 * 60 * 1000;   // 10 minutes: how long a claim is valid before recovery

// Track active in-flight delivery promises for graceful shutdown
const activePromises = new Set();
let isShuttingDown = false;

export const getActivePromises = () => activePromises;
export const getActiveDeliveriesCount = () => activePromises.size;

export const setShuttingDown = (val) => {
  isShuttingDown = val;
};

// HTML Escaper to prevent HTML injection in emails
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// URL Sanitizer to prevent malicious schemes in templates
function sanitizeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {}
  return '#';
}

// Map SMTP errors to clean privacy-safe error codes
function mapErrorToSafeCode(error) {
  const msg = (error.message || '').toUpperCase();
  const code = (error.code || '').toUpperCase();
  
  if (msg.includes('TIMEOUT') || code.includes('TIMEOUT') || error.connectionTimeout) {
    return { code: 'SMTP_TIMEOUT', message: 'SMTP connection or idle timeout' };
  }
  if (msg.includes('AUTH') || code.includes('AUTH') || msg.includes('CREDENTIALS') || code.includes('EAUTH')) {
    return { code: 'SMTP_AUTH_FAILED', message: 'SMTP authentication failed' };
  }
  if (msg.includes('REJECTED') || msg.includes('550') || msg.includes('554') || msg.includes('RECIPIENT')) {
    return { code: 'SMTP_REJECTED', message: 'Recipient or message rejected by SMTP server' };
  }
  return { code: 'UNKNOWN_DELIVERY_ERROR', message: 'An unknown delivery error occurred' };
}

// Controlled concurrency helper
async function runWithConcurrency(tasks, limit) {
  const executing = new Set();
  const results = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED CORE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function runExamReminders() {
  logger.info('⏰ Running exam reminder handler...');

  const todayStr = new Date().toISOString().split('T')[0];
  const lockKey  = `exam-reminder:${todayStr}`;
  const now      = new Date();
  const jobId    = crypto.randomUUID();

  // ── 1. Acquire a distributed lock so only one worker pod processes today's reminders ──
  try {
    const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour lock TTL
    await Lock.create({ key: lockKey, expireAt });
    logger.info(`Distributed lock acquired for ${lockKey}`, { jobId });
  } catch {
    logger.info(`Reminder skip: lock "${lockKey}" already held by another worker.`, { jobId });
    return;
  }

  // ── 2. Fetch all verified users ──
  let users;
  try {
    users = await User.find({ isVerified: true }).lean();
  } catch (err) {
    logger.error('Failed to fetch users for reminder job', { error: err.message, jobId });
    return;
  }

  const tasks = users.map(user => async () => {
    if (isShuttingDown) {
      logger.info('Graceful shutdown active: skipping claiming new reminders.', { jobId });
      return;
    }
    const p = _processUserReminder(user, todayStr, now, jobId);
    activePromises.add(p);
    try {
      await p;
    } catch (err) {
      logger.error('Unhandled error in per-user reminder process', { error: err.message, userId: user._id, jobId });
    } finally {
      activePromises.delete(p);
    }
  });

  const concurrencyLimit = env.WORKER_CONCURRENCY || 5;
  await runWithConcurrency(tasks, concurrencyLimit);

  logger.info('⏰ Exam reminder handler finished.', { jobId });
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-USER DELIVERY LOGIC
// ─────────────────────────────────────────────────────────────────────────────
async function _processUserReminder(user, todayStr, now, jobId) {
  // Check for upcoming exams in the next 3 days
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const urgentSubjects = await Subject.find({
    user: user._id,
    examDate: { $gte: now, $lte: threeDaysLater }
  }).lean();

  if (urgentSubjects.length === 0) return; // nothing to do

  const reminderType = 'exam_reminder';
  const subjectIdStr = 'null';
  const taskIdStr = 'null';
  const idempotencyKey = `${user._id}:${subjectIdStr}:${taskIdStr}:${reminderType}:${todayStr}`;

  // ── Atomic claim / stale-recovery / retry logic ──
  const claimExpiresAt = new Date(Date.now() + CLAIM_TTL_MS);
  let deliveryRecord = null;
  const maxAttempts = env.WORKER_MAX_ATTEMPTS || 3;

  // Try to find and update an existing record if it is in failed (retryable) or claimed (stale) state
  deliveryRecord = await NotificationDelivery.findOneAndUpdate(
    {
      idempotencyKey,
      $or: [
        { status: 'failed', attempts: { $lt: maxAttempts }, nextRetryAt: { $lte: now } },
        { status: 'claimed', claimExpiresAt: { $lte: now } }
      ]
    },
    {
      $set: {
        status: 'claimed',
        claimedAt: now,
        claimExpiresAt,
        failedAt: null,
        lastError: null,
        lastErrorCode: null
      },
      $inc: { attempts: 1 }
    },
    { new: true, runValidators: true }
  );

  if (!deliveryRecord) {
    // If not found, try a fresh insert (atomic create)
    try {
      deliveryRecord = await NotificationDelivery.create({
        user: user._id,
        subject: null,
        task: null,
        reminderType,
        scheduledDate: todayStr,
        status: 'claimed',
        attempts: 1,
        claimedAt: now,
        claimExpiresAt
      });
    } catch (err) {
      if (err.code === 11000) {
        // Record already exists but was not matching the claimable query (e.g. already sent or active)
        return;
      }
      throw err;
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
      return `<li><strong>${escapeHTML(s.name)}</strong> — in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</li>`;
    }).join('');

    const safeClientUrl = sanitizeUrl(env.CLIENT_URL);
    const escapedName = escapeHTML(user.name);

    await sendEmail(
      user.email,
      '⚠️ Exam Reminder — AI Study Planner',
      `<h2>Hello ${escapedName}! 👋</h2>
       <p>You have upcoming exams very soon:</p>
       <ul>${subjectList}</ul>
       ${pendingCount > 0
         ? `<p>You still have <strong>${pendingCount} pending tasks</strong>. Don't wait! 💪</p>`
         : '<p>Great job! All tasks completed! 🎉</p>'}
       <p>Log in now and keep studying!</p>
       <a href="${safeClientUrl}"
          style="background:#667eea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">
         Study Now 🚀
       </a>`
    );

    await NotificationDelivery.updateOne(
      { _id: deliveryRecord._id },
      { $set: { status: 'sent', sentAt: new Date(), lastError: null, lastErrorCode: null } }
    );
    logger.info('Exam reminder sent successfully', {
      userId: String(user._id),
      deliveryId: String(deliveryRecord._id),
      jobId
    });

  } catch (sendErr) {
    const { code: safeCode, message: safeMsg } = mapErrorToSafeCode(sendErr);
    
    // Bounded exponential backoff
    const initialInterval = env.WORKER_RETRY_INITIAL_INTERVAL_MS || 5 * 60 * 1000;
    const multiplier = env.WORKER_RETRY_MULTIPLIER || 2;
    const maxInterval = env.WORKER_RETRY_MAX_INTERVAL_MS || 60 * 60 * 1000;
    
    const backoffMs = Math.min(
      initialInterval * Math.pow(multiplier, deliveryRecord.attempts - 1),
      maxInterval
    );
    const duration = Date.now() - now.getTime();

    await NotificationDelivery.updateOne(
      { _id: deliveryRecord._id },
      {
        $set: {
          status: 'failed',
          lastError: safeMsg,
          lastErrorCode: safeCode,
          failedAt: new Date(),
          nextRetryAt: new Date(Date.now() + backoffMs)
        }
      }
    );
    
    logger.error('Failed to send exam reminder', {
      deliveryId: String(deliveryRecord._id),
      attempt: deliveryRecord.attempts,
      errorCode: safeCode,
      durationMs: duration,
      jobId
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON WRAPPER — schedules the exported handler; returns job handles for shutdown
// ─────────────────────────────────────────────────────────────────────────────
let activeCronJobs = [];

export function startCronJobs() {
  if (activeCronJobs.length > 0) {
    activeCronJobs.forEach(job => {
      if (job && typeof job.stop === 'function') {
        job.stop();
      }
    });
    activeCronJobs = [];
    logger.info('Stopped existing active cron jobs before starting new ones.');
  }

  const reminderJob = cron.schedule('0 8 * * *', runExamReminders, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('✅ Cron jobs started (exam reminder @ 08:00 UTC daily)');
  activeCronJobs = [reminderJob];
  return activeCronJobs;
}

export function stopCronJobs() {
  if (activeCronJobs.length > 0) {
    activeCronJobs.forEach(job => {
      if (job && typeof job.stop === 'function') {
        job.stop();
      }
    });
    activeCronJobs = [];
    logger.info('Stopped all active cron jobs.');
  }
}