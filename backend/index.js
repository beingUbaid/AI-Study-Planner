import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import cookieParser from 'cookie-parser'
import connectDB from './src/config/db.js'
import passport from './src/config/passport.js'

// middlewares
import { globalLimiter } from './src/middleware/rateLimiter.js'
import { globalErrorHandler } from './src/middleware/errorMiddleware.js'
import logger from './src/utils/logger.js'

// routes
import authRoutes from './src/routes/auth.js'
import subjectRoutes from './src/routes/subjects.js'
import plannerRoutes from './src/routes/planner.js'
import dashboardRoutes from './src/routes/dashboard.js'
import progressRoutes from './src/routes/progress.js'
import aiRoutes from './src/routes/ai.js'
import analyticsRoutes from './src/routes/analytics.js'

// cron jobs
import { startCronJobs } from './src/utils/cronJobs.js'

connectDB()

const app = express()

// Security headers
app.use(helmet())

// CORS setup
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))

app.use(cookieParser())

// JSON parser with body size limit for DOS protection
app.use(express.json({ limit: '10kb' }))

// Sanitize MongoDB inputs against injection attacks
app.use(mongoSanitize())

// Global request rate limiter
app.use(globalLimiter)

// Simple request logger middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
})

// Initialize passport
app.use(passport.initialize())

// all routes
app.use('/api/auth', authRoutes)
app.use('/api/subjects', subjectRoutes)
app.use('/api/planner', plannerRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/analytics', analyticsRoutes)

// test route
app.get('/', (req, res) => {
  res.send('AI Study Planner API is running ✅')
})

// start cron jobs
startCronJobs()

// Centralized error handler (must be the last middleware)
app.use(globalErrorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => logger.info(`Server running on port ${PORT} 🚀`))