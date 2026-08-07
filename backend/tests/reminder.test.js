/**
 * Integration tests for the NotificationDelivery reminder system.
 *
 * Directly calls the exported runExamReminders() function — no cron schedule needed.
 * Uses mongodb-memory-server for a real in-process Mongo instance so indexes work correctly.
 */

import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ── Mock sendEmail BEFORE importing modules that use it ────────────────────────
// We control whether email succeeds or fails per-test via globalThis.mockSendEmailShouldFail.
jest.mock('../src/utils/sendEmail.js', () => ({
  __esModule: true,
  default: jest.fn(async () => {
    if (globalThis.mockSendEmailShouldFail) throw new Error('SMTP_CONN_REFUSED');
  })
}));

// ── Import AFTER mocking ───────────────────────────────────────────────────────
import User from '../src/models/User.js';
import Subject from '../src/models/Subject.js';
import NotificationDelivery from '../src/models/NotificationDelivery.js';
import Lock from '../src/models/Lock.js';
import { runExamReminders } from '../src/utils/cronJobs.js';

let mongoServer;

beforeAll(async () => {
  if (process.env.MONGO_URI) {
    const baseUri = process.env.MONGO_URI;
    const uri = baseUri.replace(/\/([^/?]+)(?=\?|$)/, '/$1-reminder');
    console.log('Connecting to isolated MONGO_URI:', uri);
    await mongoose.connect(uri, { family: 4 });
  } else {
    try {
      mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '4.4.29'
        }
      });
      await mongoose.connect(mongoServer.getUri(), { family: 4 });
    } catch (err) {
      console.warn('MongoMemoryServer failed to start, falling back to local MongoDB service:', err);
      const fallbackUri = 'mongodb://127.0.0.1:27017/ai-study-planner-test-reminder';
      await mongoose.connect(fallbackUri, { family: 4 });
    }
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  globalThis.mockSendEmailShouldFail = false;
  // Clear all collections before each test for isolation
  await Promise.all([
    User.deleteMany({}),
    Subject.deleteMany({}),
    NotificationDelivery.deleteMany({}),
    Lock.deleteMany({})
  ]);
});

// ── Helper to create a verified user with an upcoming exam ─────────────────────
const createUserWithExam = async (daysFromNow = 2) => {
  const user = await User.create({
    name:        'Test Student',
    email:       'student@example.com',
    password:    '$2b$10$hashedpassword',   // raw hash — not used in these tests
    isVerified:  true
  });
  const examDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const subject = await Subject.create({
    user:     user._id,
    name:     'Physics',
    examDate,
    difficulty: 'Medium'
  });
  return { user, subject };
};

// ─────────────────────────────────────────────────────────────────────────────

describe('runExamReminders — core delivery lifecycle', () => {
  test('creates a NotificationDelivery record and marks it as sent on success', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];

    await runExamReminders();

    const record = await NotificationDelivery.findOne({
      user: user._id, scheduledDate: todayStr
    });
    expect(record).toBeTruthy();
    expect(record.status).toBe('sent');
    expect(record.attempts).toBe(1);
    expect(record.sentAt).toBeTruthy();
    expect(record.claimedAt).toBeTruthy();
    expect(record.claimExpiresAt).toBeTruthy();
    expect(record.lastError).toBeNull();
  });

  test('marks record as failed and sets nextRetryAt when SMTP throws', async () => {
    globalThis.mockSendEmailShouldFail = true;
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];

    await runExamReminders();

    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    expect(record.status).toBe('failed');
    expect(record.attempts).toBe(1);
    expect(record.lastError).toBeTruthy();
    expect(record.nextRetryAt).toBeTruthy();
    expect(record.nextRetryAt > new Date()).toBe(true);
    expect(record.sentAt).toBeNull();
  });

  test('does NOT re-process a record that is already sent', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];

    // Pre-create a "sent" record
    await NotificationDelivery.collection.insertOne({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'sent',
      attempts:      1,
      sentAt:        new Date(),
      idempotencyKey: `${user._id}:null:null:exam_reminder:${todayStr}`
    });

    await runExamReminders();

    // Attempts must remain 1 — not incremented
    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    expect(record.attempts).toBe(1);
    expect(record.status).toBe('sent');
  });

  test('skips user with no upcoming exams', async () => {
    // No subjects → no exams → no delivery record
    await User.create({
      name: 'No Exam Student', email: 'noexam@example.com',
      password: '$2b$10$hash', isVerified: true
    });
    const todayStr = new Date().toISOString().split('T')[0];

    await runExamReminders();

    const count = await NotificationDelivery.countDocuments({ scheduledDate: todayStr });
    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runExamReminders — stale claim recovery', () => {
  test('recovers and resends when claimExpiresAt is in the past', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];
    const past      = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago

    // Simulate a worker that crashed after claiming but before sending
    await NotificationDelivery.collection.insertOne({
      user:           user._id,
      reminderType:   'exam_reminder',
      scheduledDate:  todayStr,
      status:         'claimed',
      attempts:       1,
      claimedAt:      past,
      claimExpiresAt: past,   // already expired → stale
      idempotencyKey: `${user._id}:null:null:exam_reminder:${todayStr}`
    });

    await runExamReminders();

    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    expect(record.status).toBe('sent');
    expect(record.attempts).toBe(2);   // incremented from recovery
    expect(record.sentAt).toBeTruthy();
  });

  test('does NOT recover a claim that has not expired yet', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];
    const future    = new Date(Date.now() + 8 * 60 * 1000); // 8 min from now — still valid

    await NotificationDelivery.collection.insertOne({
      user:           user._id,
      reminderType:   'exam_reminder',
      scheduledDate:  todayStr,
      status:         'claimed',
      attempts:       1,
      claimedAt:      new Date(),
      claimExpiresAt: future,
      idempotencyKey: `${user._id}:null:null:exam_reminder:${todayStr}`
    });

    await runExamReminders();

    // Status must remain 'claimed' — record was not touched
    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    expect(record.status).toBe('claimed');
    expect(record.attempts).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runExamReminders — retry lifecycle', () => {
  test('retries a failed record when nextRetryAt has passed', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];
    const past      = new Date(Date.now() - 60 * 1000); // 1 minute ago

    await NotificationDelivery.collection.insertOne({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'failed',
      attempts:      1,
      lastError:     'SMTP_CONN_REFUSED',
      nextRetryAt:   past,
      idempotencyKey: `${user._id}:null:null:exam_reminder:${todayStr}`
    });

    await runExamReminders();

    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    expect(record.status).toBe('sent');
    expect(record.attempts).toBe(2);
  });

  test('does NOT retry when nextRetryAt is still in the future', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];
    const future    = new Date(Date.now() + 10 * 60 * 1000);

    await NotificationDelivery.collection.insertOne({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'failed',
      attempts:      1,
      lastError:     'SMTP_CONN_REFUSED',
      nextRetryAt:   future,
      idempotencyKey: `${user._id}:null:null:exam_reminder:${todayStr}`
    });

    await runExamReminders();

    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    // Must remain failed — not eligible for retry yet
    expect(record.status).toBe('failed');
    expect(record.attempts).toBe(1);
  });

  test('does not retry when MAX_ATTEMPTS exceeded', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];
    const past      = new Date(Date.now() - 60 * 1000);

    await NotificationDelivery.collection.insertOne({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'failed',
      attempts:      3,   // MAX_ATTEMPTS reached
      lastError:     'SMTP_CONN_REFUSED',
      nextRetryAt:   past,
      idempotencyKey: `${user._id}:null:null:exam_reminder:${todayStr}`
    });

    await runExamReminders();

    const record = await NotificationDelivery.findOne({ user: user._id, scheduledDate: todayStr });
    expect(record.attempts).toBe(3);  // unchanged
    expect(record.status).toBe('failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runExamReminders — concurrent execution safety', () => {
  test('prevents duplicate sends when two workers run simultaneously', async () => {
    const { user } = await createUserWithExam();
    const todayStr  = new Date().toISOString().split('T')[0];

    // Simulate two concurrent executions (second one will see the lock is held)
    await Promise.all([runExamReminders(), runExamReminders()]);

    const records = await NotificationDelivery.find({
      user: user._id, scheduledDate: todayStr
    });
    // Only one record should exist (unique index guarantees this)
    expect(records.length).toBe(1);
    expect(records[0].status).toBe('sent');
  });
});

describe('NotificationDelivery Model Schema Validation & Transitions', () => {
  test('allows creating new records with status pending or claimed', async () => {
    const user = new mongoose.Types.ObjectId();
    const doc = new NotificationDelivery({
      user,
      reminderType: 'exam_reminder',
      scheduledDate: '2026-08-03',
      status: 'pending'
    });
    await expect(doc.save()).resolves.toBeDefined();

    const doc2 = new NotificationDelivery({
      user,
      reminderType: 'study_reminder',
      scheduledDate: '2026-08-03',
      status: 'claimed'
    });
    await expect(doc2.save()).resolves.toBeDefined();
  });

  test('throws error when creating new records with status sent or failed', async () => {
    const user = new mongoose.Types.ObjectId();
    const doc = new NotificationDelivery({
      user,
      reminderType: 'exam_reminder',
      scheduledDate: '2026-08-04',
      status: 'sent'
    });
    await expect(doc.save()).rejects.toThrow(/New notification delivery cannot start with status: sent/);

    const doc2 = new NotificationDelivery({
      user,
      reminderType: 'study_reminder',
      scheduledDate: '2026-08-04',
      status: 'failed'
    });
    await expect(doc2.save()).rejects.toThrow(/New notification delivery cannot start with status: failed/);
  });

  test('allows valid status transitions', async () => {
    const user = new mongoose.Types.ObjectId();
    const doc = await NotificationDelivery.create({
      user,
      reminderType: 'exam_reminder',
      scheduledDate: '2026-08-05',
      status: 'pending'
    });

    // pending -> claimed
    doc.status = 'claimed';
    await expect(doc.save()).resolves.toBeDefined();

    // claimed -> sent
    doc.status = 'sent';
    await expect(doc.save()).resolves.toBeDefined();

    // Reset and test claimed -> failed -> claimed
    const doc2 = await NotificationDelivery.create({
      user,
      reminderType: 'study_reminder',
      scheduledDate: '2026-08-05',
      status: 'pending'
    });
    doc2.status = 'claimed';
    await doc2.save();

    doc2.status = 'failed';
    await expect(doc2.save()).resolves.toBeDefined();

    doc2.status = 'claimed';
    await expect(doc2.save()).resolves.toBeDefined();
  });

  test('throws error on invalid status transitions', async () => {
    const user = new mongoose.Types.ObjectId();
    const doc = await NotificationDelivery.create({
      user,
      reminderType: 'exam_reminder',
      scheduledDate: '2026-08-06',
      status: 'pending'
    });

    // pending -> sent (invalid)
    doc.status = 'sent';
    await expect(doc.save()).rejects.toThrow(/Invalid status transition from pending to sent/);
  });
});
