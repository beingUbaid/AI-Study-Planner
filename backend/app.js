import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from './src/config/passport.js';
import crypto from 'crypto';

// middlewares
import { globalLimiter, apiLimiter } from './src/middleware/rateLimiter.js';
import { globalErrorHandler } from './src/middleware/errorMiddleware.js';
import logger, { requestStore } from './src/utils/logger.js';
import AppError from './src/utils/appError.js';

// routes
import authRoutes from './src/routes/auth.js';
import subjectRoutes from './src/routes/subjects.js';
import plannerRoutes from './src/routes/planner.js';
import dashboardRoutes from './src/routes/dashboard.js';
import progressRoutes from './src/routes/progress.js';
import aiRoutes from './src/routes/ai.js';
import analyticsRoutes from './src/routes/analytics.js';

const app = express();

// Security headers
app.use(helmet());

// CORS setup
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.use(cookieParser());

// JSON parser with body size limit for DOS protection
app.use(express.json({ limit: '10kb' }));

// Custom MongoDB input sanitization middleware to prevent NoSQL injection (unnecessary header sanitization removed)
const sanitizeMongo = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitizeMongo(obj[key]);
      }
    }
  }
};

// Global AsyncLocalStorage request context manager and Request ID generator
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  
  const store = { requestId, userId: null };
  requestStore.run(store, () => {
    next();
  });
});

app.use((req, res, next) => {
  if (req.body) sanitizeMongo(req.body);
  if (req.params) sanitizeMongo(req.params);
  if (req.query) sanitizeMongo(req.query);
  next();
});

// Structured HTTP JSON logging middleware using winston
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request Logs', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip
    });
  });
  next();
});

// Global request rate limiter
app.use(globalLimiter);

// Initialize passport
app.use(passport.initialize());

// all routes
app.use('/api/auth', authRoutes);
app.use('/api/subjects', apiLimiter, subjectRoutes);
app.use('/api/planner', apiLimiter, plannerRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/progress', apiLimiter, progressRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);

// Test route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Standardized 404 handler for unmatched routes
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// Centralized error handler (must be the last middleware)
app.use(globalErrorHandler);

export default app;
