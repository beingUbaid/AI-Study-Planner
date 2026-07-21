import express from 'express'
import {
  addChapters,
  getChapters,
  generatePlan,
  getSchedule,
  getTodayTasks,
  markTaskComplete,
  exportICS
} from '../controllers/plannerController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(authMiddleware)

router.post('/chapters/:subjectId', addChapters)
router.get('/chapters/:subjectId', getChapters)
router.post('/generate', generatePlan)
router.get('/schedule', getSchedule)
router.get('/today', getTodayTasks)
router.patch('/complete', markTaskComplete)
router.get('/export-ics', exportICS)

export default router