import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';
import { catchAsync } from '../middleware/errorMiddleware.js';
import AppError from '../utils/appError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
  clearRefreshTokenCookie,
  verifyRefreshToken,
  hashToken
} from '../services/tokenService.js';
import RefreshToken from '../models/RefreshToken.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

// Cryptographically secure 6-digit code generator
const generateSecureCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// ─────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────
export const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('This email is already registered.', 400));
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const verifyCode = generateSecureCode();
  const verifyCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins validity

  await User.create({
    name,
    email,
    password: hashedPassword,
    verifyCode,
    verifyCodeExpiry,
  });

  await sendEmail(
    email,
    'Verify Your Email - AI Study Planner',
    `
      <h2>Hello ${name}! 👋</h2>
      <p>Your verification code is:</p>
      <h1 style="color: #4F46E5; letter-spacing: 5px; font-family: monospace;">${verifyCode}</h1>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you did not create this account, please ignore this email.</p>
      <hr />
      <p style="font-size: 12px; color: #6b7280;">Security notice: Do not share this code with anyone.</p>
    `
  );

  res.status(201).json({
    status: 'success',
    message: 'Registration successful! Please check your email for the verification code ✅',
    email
  });
});

// ─────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────
export const verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  if (user.isVerified) {
    return next(new AppError('Email is already verified.', 400));
  }

  if (user.verifyCode !== code) {
    return next(new AppError('Invalid verification code. Please check and try again.', 400));
  }

  if (user.verifyCodeExpiry < new Date()) {
    return next(new AppError('Verification code has expired. Please register again.', 400));
  }

  user.isVerified = true;
  user.verifyCode = null;
  user.verifyCodeExpiry = null;
  await user.save();

  const accessToken = generateAccessToken(user._id);
  const familyId = crypto.randomUUID();
  const newRefreshToken = generateRefreshToken(user._id, familyId);
  const tokenHash = hashToken(newRefreshToken);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    familyId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  sendRefreshTokenCookie(res, newRefreshToken);

  res.status(200).json({
    status: 'success',
    message: 'Email successfully verified!',
    token: accessToken,
    user: { id: user._id, name: user.name, email: user.email }
  });
});

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('Invalid credentials.', 401));
  }

  // Check if locked out
  if (user.isLocked) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    return next(new AppError(`Account is temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`, 423));
  }

  if (!user.isVerified) {
    return next(new AppError('Please verify your email address before logging in.', 403));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    // Increment failed login attempts
    user.loginAttempts += 1;
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
    }
    await user.save();
    return next(new AppError('Invalid credentials.', 401));
  }

  // Reset lockouts on successful login
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  const accessToken = generateAccessToken(user._id);
  const familyId = crypto.randomUUID();
  const newRefreshToken = generateRefreshToken(user._id, familyId);
  const tokenHash = hashToken(newRefreshToken);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    familyId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  sendRefreshTokenCookie(res, newRefreshToken);

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    token: accessToken,
    user: { id: user._id, name: user.name, email: user.email }
  });
});

// ─────────────────────────────────────────
// REFRESH TOKEN ROTATION
// ─────────────────────────────────────────
export const refreshToken = catchAsync(async (req, res, next) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return next(new AppError('No refresh token provided.', 401));
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    clearRefreshTokenCookie(res);
    return next(new AppError('Invalid refresh token.', 401));
  }

  const incomingHash = hashToken(token);
  const storedToken = await RefreshToken.findOne({ tokenHash: incomingHash });

  // Reuse detection: if storedToken doesn't exist OR it is already flagged as revoked
  if (!storedToken || storedToken.isRevoked) {
    if (decoded.familyId) {
      await RefreshToken.updateMany({ familyId: decoded.familyId }, { isRevoked: true });
    }
    clearRefreshTokenCookie(res);
    return next(new AppError('Refresh token reuse detected. Revoking session lineage.', 401));
  }

  // Old token is now revoked
  storedToken.isRevoked = true;
  await storedToken.save();

  // Generate new refresh token in the same family
  const newAccessToken = generateAccessToken(decoded.id);
  const newRefreshToken = generateRefreshToken(decoded.id, decoded.familyId);
  const newHash = hashToken(newRefreshToken);

  await RefreshToken.create({
    user: decoded.id,
    tokenHash: newHash,
    familyId: decoded.familyId,
    expiresAt: storedToken.expiresAt
  });

  sendRefreshTokenCookie(res, newRefreshToken);

  res.status(200).json({
    status: 'success',
    token: newAccessToken
  });
});

// ─────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────
export const logout = catchAsync(async (req, res, next) => {
  const token = req.cookies.refreshToken;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      if (decoded.familyId) {
        await RefreshToken.deleteMany({ familyId: decoded.familyId });
      }
    } catch {
      // Ignore token verification errors during logout
    }
  }

  clearRefreshTokenCookie(res);

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// ─────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────
export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // To prevent account harvesting, return success even if user not found, but log internally
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with this email, a reset code has been sent ✅'
    });
  }

  const resetCode = generateSecureCode();
  const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  user.resetCode = resetCode;
  user.resetCodeExpiry = resetCodeExpiry;
  await user.save();

  await sendEmail(
    email,
    'Password Reset Code - AI Study Planner',
    `
      <h2>Password Reset Request 🔐</h2>
      <p>Your password reset code is:</p>
      <h1 style="color: #4F46E5; letter-spacing: 5px; font-family: monospace;">${resetCode}</h1>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `
  );

  res.status(200).json({
    status: 'success',
    message: 'Reset code sent to your email ✅'
  });
});

// ─────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────
export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, code, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  if (user.resetCode !== code) {
    return next(new AppError('Invalid reset code.', 400));
  }

  if (user.resetCodeExpiry < new Date()) {
    return next(new AppError('Reset code has expired.', 400));
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  user.password = hashedPassword;
  user.resetCode = null;
  user.resetCodeExpiry = null;
  user.loginAttempts = 0; // Reset login attempts
  user.lockUntil = null;
  user.refreshTokens = []; 
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });

  res.status(200).json({
    status: 'success',
    message: 'Password reset successful! You can now log in with your new password ✅'
  });
});