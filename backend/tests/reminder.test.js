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
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '4.4.29'
    }
  });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
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
    await NotificationDelivery.create({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'sent',
      attempts:      1,
      sentAt:        new Date()
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
    await NotificationDelivery.create({
      user:           user._id,
      reminderType:   'exam_reminder',
      scheduledDate:  todayStr,
      status:         'claimed',
      attempts:       1,
      claimedAt:      past,
      claimExpiresAt: past   // already expired → stale
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

    await NotificationDelivery.create({
      user:           user._id,
      reminderType:   'exam_reminder',
      scheduledDate:  todayStr,
      status:         'claimed',
      attempts:       1,
      claimedAt:      new Date(),
      claimExpiresAt: future
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

    await NotificationDelivery.create({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'failed',
      attempts:      1,
      lastError:     'SMTP_CONN_REFUSED',
      nextRetryAt:   past
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

    await NotificationDelivery.create({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'failed',
      attempts:      1,
      lastError:     'SMTP_CONN_REFUSED',
      nextRetryAt:   future
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

    await NotificationDelivery.create({
      user:          user._id,
      reminderType:  'exam_reminder',
      scheduledDate: todayStr,
      status:        'failed',
      attempts:      3,   // MAX_ATTEMPTS reached
      lastError:     'SMTP_CONN_REFUSED',
      nextRetryAt:   past
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
