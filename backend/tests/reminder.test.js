import { jest } from '@jest/globals';

// Mock sendEmail utility to simulate success or failures
let mockSendEmailShouldFail = false;
jest.mock('../src/utils/sendEmail.js', () => {
  return {
    __esModule: true,
    default: async () => {
      if (mockSendEmailShouldFail) {
        throw new Error('SMTP Connection Refused');
      }
      return true;
    }
  };
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Subject from '../src/models/Subject.js';
import NotificationDelivery from '../src/models/NotificationDelivery.js';
import { startCronJobs } from '../src/utils/cronJobs.js';

let mongoServer;
let reminderCronJob;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // Start cron jobs to hook handles
  const jobs = startCronJobs();
  reminderCronJob = jobs[0];
});

afterAll(async () => {
  if (reminderCronJob) {
    reminderCronJob.stop();
  }
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  mockSendEmailShouldFail = false;
  // Clear collections
  await User.deleteMany({});
  await Subject.deleteMany({});
  await NotificationDelivery.deleteMany({});
});

describe('Stateful NotificationDelivery & Cron Reminder Tests', () => {

  test('should successfully claim and send daily reminder idempotently', async () => {
    // 1. Setup User and Subject
    const user = await User.create({
      name: 'Test Student',
      email: 'student@example.com',
      password: 'hashed_password_123',
      isVerified: true
    });

    await Subject.create({
      user: user._id,
      name: 'Physics',
      examDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // exam in 2 days
    });

    // 2. Trigger cron job execution handler
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Run the internal cron handler function directly
    const cronHandler = reminderCronJob._task._execution;
    await cronHandler();

    // 3. Verify NotificationDelivery record was created and status is 'sent'
    const delivery = await NotificationDelivery.findOne({
      user: user._id,
      reminderType: 'exam_reminder',
      scheduledDate: todayStr
    });

    expect(delivery).toBeTruthy();
    expect(delivery.status).toBe('sent');
    expect(delivery.attempts).toBe(1);
  });

  test('should fail send attempts and update retry states', async () => {
    mockSendEmailShouldFail = true;

    const user = await User.create({
      name: 'Test Student',
      email: 'student@example.com',
      isVerified: true
    });

    await Subject.create({
      user: user._id,
      name: 'Chemistry',
      examDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });

    const cronHandler = reminderCronJob._task._execution;
    await cronHandler();

    const todayStr = new Date().toISOString().split('T')[0];
    const delivery = await NotificationDelivery.findOne({
      user: user._id,
      scheduledDate: todayStr
    });

    expect(delivery).toBeTruthy();
    expect(delivery.status).toBe('failed');
    expect(delivery.attempts).toBe(1);
    expect(delivery.lastError).toBe('SMTP Connection Refused');
    expect(delivery.nextRetryAt).toBeTruthy();
  });

  test('should recover stale claimed records on subsequent cron runs', async () => {
    const user = await User.create({
      name: 'Test Student',
      email: 'student@example.com',
      isVerified: true
    });

    await Subject.create({
      user: user._id,
      name: 'Biology',
      examDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Create a stale "claimed" record (updated 15 minutes ago)
    const staleTime = new Date(Date.now() - 15 * 60 * 1000);
    const deliveryRecord = await NotificationDelivery.create({
      user: user._id,
      reminderType: 'exam_reminder',
      scheduledDate: todayStr,
      status: 'claimed',
      attempts: 1,
      nextRetryAt: staleTime
    });

    // Manually force updatedAt back to staleTime
    await NotificationDelivery.updateOne(
      { _id: deliveryRecord._id },
      { updatedAt: staleTime }
    );

    // Run cron handler
    const cronHandler = reminderCronJob._task._execution;
    await cronHandler();

    // Verify record was claimed, incremented, and sent
    const updatedDelivery = await NotificationDelivery.findById(deliveryRecord._id);
    expect(updatedDelivery.status).toBe('sent');
    expect(updatedDelivery.attempts).toBe(2);
  });

  test('should not process double notifications if status is sent', async () => {
    const user = await User.create({
      name: 'Test Student',
      email: 'student@example.com',
      isVerified: true
    });

    await Subject.create({
      user: user._id,
      name: 'Physics',
      examDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Set pre-existing successful 'sent' status
    await NotificationDelivery.create({
      user: user._id,
      reminderType: 'exam_reminder',
      scheduledDate: todayStr,
      status: 'sent',
      attempts: 1
    });

    // Run cron handler
    const cronHandler = reminderCronJob._task._execution;
    await cronHandler();

    // Verify attempts remains 1, confirming it wasn't re-processed
    const delivery = await NotificationDelivery.findOne({
      user: user._id,
      scheduledDate: todayStr
    });
    expect(delivery.attempts).toBe(1);
    expect(delivery.status).toBe('sent');
  });
});
