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
  verifyRefreshToken
} from '../services/tokenService.js';

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

  const user = await User.create({
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

  const accessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshTokens = [newRefreshToken];
  await user.save();

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

  const accessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  // Rotate/Store Refresh Tokens (support multi-device by cleaning old tokens and pushing new)
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(newRefreshToken);

  // Keep max 5 active refresh tokens to prevent token bloat
  if (user.refreshTokens.length > 5) {
    user.refreshTokens.shift();
  }

  await user.save();

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

  // Clear cookie and verify token
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    // If invalid token, clear cookies anyway to be clean
    clearRefreshTokenCookie(res);
    return next(new AppError('Invalid refresh token.', 401));
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.refreshTokens.includes(token)) {
    // Possible token reuse attack or invalid user
    if (user) {
      // Revoke all tokens if we suspect token reuse
      user.refreshTokens = [];
      await user.save();
    }
    clearRefreshTokenCookie(res);
    return next(new AppError('Session expired or security violation detected.', 401));
  }

  // Rotate token: remove old one, generate new one
  user.refreshTokens.pull(token);

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshTokens.push(newRefreshToken);
  await user.save();

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
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
      const user = await User.findById(decoded.id);
      if (user) {
        user.refreshTokens.pull(token);
        await user.save();
      }
    } catch (err) {
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
  user.refreshTokens = []; // Revoke active sessions on password change for security
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password reset successful! You can now log in with your new password ✅'
  });
});