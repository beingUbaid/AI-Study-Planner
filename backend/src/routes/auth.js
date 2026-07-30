import express from 'express';
import passport from 'passport';
import crypto from 'crypto';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout
} from '../controllers/authController.js';
import { generateAccessToken, generateRefreshToken, sendRefreshTokenCookie, hashToken } from '../services/tokenService.js';
import RefreshToken from '../models/RefreshToken.js';

const router = express.Router();

// Apply brute-force protection rate limiter to all auth routes
router.use(authLimiter);

router.post(
  '/register',
  validate([
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ]),
  register
);

router.post(
  '/verify-email',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Verification code must be 6 digits')
  ]),
  verifyEmail
);

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required')
  ]),
  login
);

router.post('/refresh', refreshToken);
router.post('/logout', logout);

router.post(
  '/forgot-password',
  validate([
    body('email').isEmail().withMessage('Please enter a valid email address')
  ]),
  forgotPassword
);

router.post(
  '/reset-password',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Reset code must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ]),
  resetPassword
);

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login` }),
  async (req, res, next) => {
    try {
      const user = req.user;
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

      res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${accessToken}`);
    } catch (error) {
      next(error);
    }
  }
);

export default router;