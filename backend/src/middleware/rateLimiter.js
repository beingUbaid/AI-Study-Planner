import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Limit each IP to 15 authentication requests per hour
  message: {
    status: 'fail',
    message: 'Too many authentication attempts. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

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
