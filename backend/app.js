import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from './src/config/passport.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from './src/config/env.js';

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

// Security headers with strict CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.groq.com"]
    }
  }
}));

// Whitelisted CORS setup (supports credentials securely for verified domains only)
const allowedOrigins = env.ALLOWED_ORIGINS 
  ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : [env.CLIENT_URL];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(cookieParser());

// Payload parsers with body size limits for DOS protection
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

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

// Global AsyncLocalStorage request context manager and Request ID validator
app.use((req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const uuidRegex = /^[a-zA-Z0-9-]{1,36}$/;
  // Validate incoming ID format/length or generate a fresh secure one
  const requestId = (incomingId && uuidRegex.test(incomingId))
    ? incomingId
    : crypto.randomUUID();

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

// Readiness, health and version endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    return res.status(200).json({ status: 'READY', database: 'connected' });
  } else {
    return res.status(503).json({ status: 'NOT_READY', database: 'disconnected' });
  }
});

app.get('/version', (req, res) => {
  res.status(200).json({ version: process.env.APP_VERSION || '1.0.0' });
});

// Standardized 404 handler for unmatched routes
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// Centralized error handler (must be the last middleware)
app.use(globalErrorHandler);

export default app;
