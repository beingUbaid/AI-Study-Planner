import { jest } from '@jest/globals';

jest.mock('../src/utils/sendEmail.js', () => {
  return {
    __esModule: true,
    default: async () => true
  };
});

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../src/models/User.js';
import RefreshToken from '../src/models/RefreshToken.js';

let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'test_jwt_access_secret_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_54321';
  // Use a much smaller MongoDB binary version (4.4.29 is ~70MB compared to 8.x which is ~780MB)
  // to avoid network timeouts during automated tests.
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '4.4.29'
    }
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 300000); // 5-minute timeout for initial binary download

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('SaaS Auth Integration Tests', () => {
  const registerPayload = {
    name: 'Test Student',
    email: 'student@example.com',
    password: 'SecurePassword123!'
  };

  test('should register a new user successfully but keep as unverified', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(registerPayload);

    console.log('DEBUG RES BODY:', res.body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.email).toBe(registerPayload.email);

    const user = await User.findOne({ email: registerPayload.email });
    expect(user).toBeTruthy();
    expect(user.isVerified).toBe(false);
    expect(user.verifyCode).toBeTruthy();
  });

  test('should verify email and return access token with HttpOnly cookie', async () => {
    // 1. Register
    await request(app).post('/api/auth/register').send(registerPayload);
    const user = await User.findOne({ email: registerPayload.email });
    const code = user.verifyCode;

    // 2. Verify
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: registerPayload.email, code });

    console.log('DEBUG VERIFY RES BODY:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeTruthy();
    
    // Check httpOnly cookies are sent
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('refreshToken'))).toBe(true);

    const updatedUser = await User.findOne({ email: registerPayload.email });
    expect(updatedUser.isVerified).toBe(true);
    
    const refreshTokensCount = await RefreshToken.countDocuments({ user: updatedUser._id });
    expect(refreshTokensCount).toBe(1);
  });

  test('should rotate refresh token and revoke all if reuse is detected', async () => {
    // 1. Setup verified user
    await request(app).post('/api/auth/register').send(registerPayload);
    const user = await User.findOne({ email: registerPayload.email });
    user.isVerified = true;
    await user.save();

    // 2. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: registerPayload.email, password: registerPayload.password });

    console.log('DEBUG LOGIN RES BODY:', loginRes.body);
    const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : null;
    
    // 3. Refresh first time (rotation)
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [cookie]);

    console.log('DEBUG REFRESH RES BODY:', refreshRes.body);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeTruthy();
    
    // 4. Try refreshing with the OLD cookie (reuse attack detection)
    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [cookie]);

    expect(reuseRes.status).toBe(401);
    
    // All tokens in the family must be flagged as revoked on reuse detection
    const finalUser = await User.findOne({ email: registerPayload.email });
    const activeTokensCount = await RefreshToken.countDocuments({ user: finalUser._id, isRevoked: false });
    expect(activeTokensCount).toBe(0);
  });

  test('should lock out account after 5 failed login attempts', async () => {
    // Register & verify user
    await request(app).post('/api/auth/register').send(registerPayload);
    const user = await User.findOne({ email: registerPayload.email });
    user.isVerified = true;
    await user.save();

    // Try logging in with wrong password 5 times
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: 'WrongPassword!' });
      
      expect(res.status).toBe(401);
    }

    // 6th attempt should return 423 locked
    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: registerPayload.email, password: registerPayload.password });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.message).toContain('locked');
  });
});
