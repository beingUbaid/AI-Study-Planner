import rateLimit from 'express-rate-limit';

// Global request rate limiter
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window for public assets + general APIs
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiter for sensitive routes (signup, login, password resets)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Limit each IP to 15 auth requests per hour
  message: {
    status: 'fail',
    message: 'Too many authentication attempts. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// AI generation rate limiter (to prevent cost overruns)
export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 AI generations per 10 minutes
  message: {
    status: 'fail',
    message: 'AI generation limit reached. Please wait a few minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Uploads rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 PDF uploads per hour
  message: {
    status: 'fail',
    message: 'PDF upload limit reached. You can only upload 5 syllabi per hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// General API routes limiter (for resources like subjects, planner, progress)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per 15 minutes
  message: {
    status: 'fail',
    message: 'Too many API requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
