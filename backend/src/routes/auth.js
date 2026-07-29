import express from 'express';
import passport from 'passport';
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
import { generateAccessToken, generateRefreshToken, sendRefreshTokenCookie } from '../services/tokenService.js';

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
      const newRefreshToken = generateRefreshToken(user._id);

      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push(newRefreshToken);
      await user.save();

      sendRefreshTokenCookie(res, newRefreshToken);

      res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${accessToken}`);
    } catch (error) {
      next(error);
    }
  }
);

export default router;