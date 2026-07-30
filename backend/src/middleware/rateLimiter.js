import rateLimit from 'express-rate-limit';

// Key generator that prioritizes authenticated user IDs over raw IP addresses to support safe nat/proxy environments
const userOrIPKeyGenerator = (req) => {
  return req.user && req.user.id ? req.user.id : req.ip;
};

// Global request rate limiter
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiter for sensitive routes (signup, login, resets, refresh)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  message: {
    status: 'fail',
    message: 'Too many authentication attempts. Please try again after an hour.'
  },
  keyGenerator: userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false
});

// AI generation rate limiter (to prevent cost overruns)
export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: {
    status: 'fail',
    message: 'AI generation limit reached. Please wait a few minutes before trying again.'
  },
  keyGenerator: userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false
});

// Uploads rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    status: 'fail',
    message: 'PDF upload limit reached. You can only upload 5 syllabi per hour.'
  },
  keyGenerator: userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false
});

// General API routes limiter (for resources like subjects, planner, progress, analytics)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  message: {
    status: 'fail',
    message: 'Too many API requests. Please slow down.'
  },
  keyGenerator: userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false
});
