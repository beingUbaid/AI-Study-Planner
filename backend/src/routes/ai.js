import express from 'express';
import multer from 'multer';
import fs from 'fs';
import {
  aiGenerateSchedule,
  aiChat,
  uploadPDF,
  aiGenerateFlashcards,
  aiGenerateQuiz,
  aiGenerateExamMode,
  getJobStatus
} from '../controllers/aiController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validatePDFMagicBytes } from '../middleware/uploadValidator.js';

import { uploadLimiter, aiLimiter } from '../middleware/rateLimiter.js';

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Hardened 5MB limit for DOS protection
});

router.use(authMiddleware);

router.post('/generate-schedule', aiLimiter, aiGenerateSchedule);
router.post('/chat', aiLimiter, aiChat);
router.post('/upload-pdf', uploadLimiter, upload.single('file'), validatePDFMagicBytes, uploadPDF);
router.post('/generate-flashcards', aiLimiter, aiGenerateFlashcards);
router.post('/generate-quiz', aiLimiter, aiGenerateQuiz);
router.post('/generate-exam-mode', aiLimiter, aiGenerateExamMode);
router.get('/job/:jobId', getJobStatus);

export default router;