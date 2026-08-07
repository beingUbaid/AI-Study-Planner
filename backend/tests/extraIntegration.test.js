import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../src/models/User.js';
import Subject from '../src/models/Subject.js';
import RefreshToken from '../src/models/RefreshToken.js';
import NotificationDelivery from '../src/models/NotificationDelivery.js';
import Lock from '../src/models/Lock.js';

// Setup Mock for email transport
jest.mock('../src/utils/sendEmail.js', () => ({
  __esModule: true,
  default: jest.fn(async () => {
    if (globalThis.mockSendEmailShouldFail) throw new Error('SMTP_CONN_REFUSED');
  })
}));

let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.AI_PROVIDER = 'mock';
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.JWT_SECRET = 'ci_test_jwt_access_secret_32chars_long_ok_pad';
  process.env.JWT_REFRESH_SECRET = 'ci_test_jwt_refresh_secret_32chars_long_ok_pad';

  if (process.env.MONGO_URI) {
    const baseUri = process.env.MONGO_URI;
    const uri = baseUri.replace(/\/([^/?]+)(?=\?|$)/, '/$1-extra');
    console.log('Connecting to isolated MONGO_URI:', uri);
    await mongoose.connect(uri);
  } else {
    try {
      mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '4.4.29'
        }
      });
      await mongoose.connect(mongoServer.getUri());
    } catch (err) {
      console.warn('MongoMemoryServer failed to start, falling back to local MongoDB service:', err);
      const fallbackUri = 'mongodb://127.0.0.1:27017/ai-study-planner-test-extra';
      await mongoose.connect(fallbackUri);
    }
  }
  
  // Await real index creation directly on MongoDB to enforce uniqueness
  await Promise.all([
    User.ensureIndexes(),
    Subject.ensureIndexes(),
    RefreshToken.ensureIndexes(),
    NotificationDelivery.ensureIndexes(),
    Lock.ensureIndexes()
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  globalThis.mockSendEmailShouldFail = false;
  // Clean database
  await Promise.all([
    User.deleteMany({}),
    Subject.deleteMany({}),
    RefreshToken.deleteMany({}),
    NotificationDelivery.deleteMany({}),
    Lock.deleteMany({})
  ]);
});

describe('SaaS Security & Worker Integration Tests', () => {
  const userAPayload = {
    name: 'User Alpha',
    email: 'alpha@example.com',
    password: 'SecurePassword123!'
  };

  const userBPayload = {
    name: 'User Beta',
    email: 'beta@example.com',
    password: 'SecurePassword123!'
  };

  const getVerifiedUserTokens = async (payload) => {
    // Register
    await request(app).post('/api/auth/register').send(payload);
    const user = await User.findOne({ email: payload.email });
    user.isVerified = true;
    await user.save();

    // Login
    const loginRes = await request(app).post('/api/auth/login').send({
      email: payload.email,
      password: payload.password
    });
    
    const cookies = loginRes.headers['set-cookie'];
    return {
      token: loginRes.body.token,
      user,
      cookie: cookies ? cookies[0] : null
    };
  };

  // 1. Cross-User Resource Denial
  test('User B cannot access or modify User A\'s Subject', async () => {
    const alpha = await getVerifiedUserTokens(userAPayload);
    const beta = await getVerifiedUserTokens(userBPayload);

    // Create subject under Alpha
    const subjectRes = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${alpha.token}`)
      .send({
        name: 'Quantum Physics',
        difficulty: 'Hard',
        examDate: '2026-10-01'
      });

    const subjectId = subjectRes.body.subject._id;
    expect(subjectId).toBeDefined();

    // User B tries to fetch User A's subject details -> expects 404 or 403
    const getRes = await request(app)
      .get(`/api/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${beta.token}`);
    
    expect(getRes.status).toBe(404);

    // User B tries to update User A's subject -> expects 404 or 403
    const putRes = await request(app)
      .put(`/api/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${beta.token}`)
      .send({ name: 'Hacked Subject' });

    expect(putRes.status).toBe(404);

    // User B tries to delete User A's subject -> expects 404 or 403
    const deleteRes = await request(app)
      .delete(`/api/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${beta.token}`);

    expect(deleteRes.status).toBe(404);
  });

  // 2. Token Invalidation on Password Change
  test('Password change invalidates all existing refresh tokens', async () => {
    const alpha = await getVerifiedUserTokens(userAPayload);
    expect(alpha.cookie).toBeTruthy();

    const initialTokensCount = await RefreshToken.countDocuments({ user: alpha.user._id });
    expect(initialTokensCount).toBe(1);

    // Trigger Forgot Password to generate resetCode
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: userAPayload.email });
    
    const user = await User.findOne({ email: userAPayload.email });
    const resetCode = user.resetCode;
    expect(resetCode).toBeTruthy();

    // Reset password (this must delete all active refresh tokens)
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: userAPayload.email,
        code: resetCode,
        newPassword: 'BrandNewSecurePassword789!'
      });

    expect(resetRes.status).toBe(200);

    // Check refresh tokens in DB -> expects 0
    const finalTokensCount = await RefreshToken.countDocuments({ user: alpha.user._id });
    expect(finalTokensCount).toBe(0);

    // Trying to refresh with the old cookie must fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [alpha.cookie]);

    expect(refreshRes.status).toBe(401);
  });

  // 3. Fake and Oversized PDF Rejections
  test('Upload fails if the file has invalid magic bytes or is fake PDF', async () => {
    const alpha = await getVerifiedUserTokens(userAPayload);
    const fakePDFBuffer = Buffer.from('NOT-A-PDF-MAGIC-BYTES-DATA');

    const res = await request(app)
      .post('/api/ai/upload-pdf')
      .set('Authorization', `Bearer ${alpha.token}`)
      .attach('file', fakePDFBuffer, 'syllabus.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('header does not match a valid PDF structure');
  });

  // 4. CORS Operational AppError
  test('CORS rejects unauthorized origins with a controlled 403 AppError', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://malicious-site.com');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Not allowed by CORS');
    expect(res.body.status).toBe('fail');
  });

  // 5. Readiness Ping Failure Simulation
  test('Readiness fails when database connectivity is unavailable', async () => {
    const originalConnection = mongoose.connection;
    
    // Swap mongoose.connection temporarily to return readyState 0
    Object.defineProperty(mongoose, 'connection', {
      value: { readyState: 0 },
      configurable: true
    });

    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('NOT_READY');

    // Restore mongoose.connection
    Object.defineProperty(mongoose, 'connection', {
      value: originalConnection,
      configurable: true
    });
  });

  // 6. Worker Claim Operations under Concurrency
  test('Two concurrent claims update atomic state correctly', async () => {
    const alpha = await getVerifiedUserTokens(userAPayload);
    const todayStr = new Date().toISOString().split('T')[0];
    const claimExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const doc1 = new NotificationDelivery({
      user: alpha.user._id,
      reminderType: 'exam_reminder',
      scheduledDate: todayStr,
      status: 'claimed',
      attempts: 1,
      claimedAt: new Date(),
      claimExpiresAt
    });

    const doc2 = new NotificationDelivery({
      user: alpha.user._id,
      reminderType: 'exam_reminder',
      scheduledDate: todayStr,
      status: 'claimed',
      attempts: 1,
      claimedAt: new Date(),
      claimExpiresAt
    });

    // Validate in memory to generate keys
    await doc1.validate();
    await doc2.validate();

    // Trigger two concurrent atomic creations (simulating workers racing)
    const p1 = doc1.save();
    const p2 = doc2.save();

    // One must fail with unique index exception (11000)
    let failedCount = 0;
    try {
      await Promise.all([p1, p2]);
    } catch (err) {
      if (err.code === 11000 || err.message.includes('11000')) {
        failedCount = 1;
      }
    }
    expect(failedCount).toBe(1);
    
    const records = await NotificationDelivery.find({ user: alpha.user._id, scheduledDate: todayStr });
    expect(records.length).toBe(1);
  });
});
