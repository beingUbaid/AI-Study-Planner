import express from 'express'
import {
  logTodaySession,
  getWeeklyAnalytics,
  getSummary,
  getAnalyticsInsights
} from '../controllers/analyticsController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(authMiddleware)

router.post('/log', logTodaySession)
router.get('/weekly', getWeeklyAnalytics)
router.get('/summary', getSummary)
router.get('/insights', getAnalyticsInsights)

export default router