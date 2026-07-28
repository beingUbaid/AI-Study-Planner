import express from 'express'
import {
  addSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  logQuizScore
} from '../controllers/subjectController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

// all routes below are protected — must be logged in
router.use(authMiddleware)

router.post('/', addSubject)
router.get('/', getSubjects)
router.put('/:id', updateSubject)
router.delete('/:id', deleteSubject)
router.post('/:id/quiz', logQuizScore)

export default router