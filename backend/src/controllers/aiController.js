import fs from 'fs';
import Subject from '../models/Subject.js';
import Chapter from '../models/Chapter.js';
import StudyPlan from '../models/StudyPlan.js';
import Job from '../models/Job.js';
import queueService from '../services/queueService.js';
import * as aiService from '../services/aiService.js';
import { extractTextFromPDF } from '../utils/pdfExtract.js';
import { rebalanceStudyPlan } from '../utils/rebalanceHelper.js';
import { catchAsync } from '../middleware/errorMiddleware.js';
import AppError from '../utils/appError.js';

// ─────────────────────────────────────────
// 1. AI SCHEDULE GENERATOR
// ─────────────────────────────────────────
export const aiGenerateSchedule = catchAsync(async (req, res, next) => {
  const { message } = req.body;
  if (!message) {
    return next(new AppError('Please describe your study situation', 400));
  }

  const subjects = await Subject.find({ user: req.user.id });
  const studyPlan = await StudyPlan.findOne({ user: req.user.id });

  const subjectContext = subjects.length > 0
    ? subjects.map(s => {
        const daysLeft = Math.ceil((new Date(s.examDate) - new Date()) / (1000 * 60 * 60 * 24));
        return `${s.name} (exam in ${daysLeft} days, difficulty: ${s.difficulty})`;
      }).join(', ')
    : 'No subjects added yet';

  const progressContext = studyPlan
    ? `Student has an existing study plan with ${studyPlan.schedule.length} days`
    : 'No study plan yet';

  const aiResponse = await aiService.generateAISchedule(message, subjectContext, progressContext);

  res.status(200).json({
    status: 'success',
    message: 'AI schedule generated ✅',
    response: aiResponse
  });
});

// ─────────────────────────────────────────
// 2. AI STUDY ASSISTANT CHATBOT (with Auto-Rebalance)
// ─────────────────────────────────────────
export const aiChat = catchAsync(async (req, res, next) => {
  const { message, history = [] } = req.body;
  if (!message) {
    return next(new AppError('Please send a message', 400));
  }

  const subjects = await Subject.find({ user: req.user.id });
  const studyPlan = await StudyPlan.findOne({ user: req.user.id });

  let context = 'Student information:\n';

  if (subjects.length > 0) {
    context += 'Subjects:\n';
    subjects.forEach(s => {
      const daysLeft = Math.ceil((new Date(s.examDate) - new Date()) / (1000 * 60 * 60 * 24));
      context += `- ${s.name}: exam in ${daysLeft} days, difficulty: ${s.difficulty}\n`;
    });
  }

  if (studyPlan) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPlan = studyPlan.schedule.find(day => {
      const d = new Date(day.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    if (todayPlan) {
      context += `\nToday's tasks:\n`;
      todayPlan.tasks.forEach(t => {
        context += `- ${t.subjectName}: ${t.chapterName} (${t.isCompleted ? 'completed ✅' : 'pending ⏳'})\n`;
      });
    }

    const allTasks = studyPlan.schedule.flatMap(d => d.tasks);
    const completed = allTasks.filter(t => t.isCompleted).length;
    context += `\nOverall progress: ${completed}/${allTasks.length} tasks completed`;
  }

  let aiResponse = await aiService.generateAIChat(message, history, context);
  let rebalanced = false;
  let rescheduledCount = 0;

  if (aiResponse.includes('[TRIGGER_REBALANCE]')) {
    aiResponse = aiResponse.replace('[TRIGGER_REBALANCE]', '').trim();
    if (studyPlan && studyPlan.schedule.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = rebalanceStudyPlan(studyPlan, today);
      rescheduledCount = result.rescheduledCount;
      if (rescheduledCount > 0) {
        const logItem = {
          date: new Date(),
          trigger: `Chatbot request: "${message.length > 50 ? message.substring(0, 50) + '...' : message}"`,
          explanation: aiResponse
        };
        studyPlan.rebalanceLogs = studyPlan.rebalanceLogs || [];
        studyPlan.rebalanceLogs.push(logItem);
        await studyPlan.save();
        rebalanced = true;
      }
    }
    if (!rebalanced) {
      aiResponse = aiResponse + "\n\n*(Note: I checked your schedule and everything is currently on track! No pending past tasks were found to reschedule.)*";
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Response generated ✅',
    response: aiResponse,
    rebalanced,
    rescheduledCount,
    history: [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    ]
  });
});

// ─────────────────────────────────────────
// 3. ASYNCHRONOUS PDF SYLLABUS UPLOAD
// ─────────────────────────────────────────
export const uploadPDF = catchAsync(async (req, res, next) => {
  const { subjectId } = req.body;
  if (!req.file) {
    return next(new AppError('Please upload a PDF file', 400));
  }

  const subject = await Subject.findOne({
    _id: subjectId,
    user: req.user.id
  });

  if (!subject) {
    // Delete file if subject doesn't exist
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new AppError('Subject not found', 404));
  }

  // Create a background job for parsing syllabus
  const job = await queueService.createJob(req.user.id, 'syllabus_extraction');

  // Enqueue job asynchronously
  queueService.enqueue(job._id, async (updateProgress) => {
    try {
      await updateProgress(20);
      const pdfText = await extractTextFromPDF(req.file.path);

      await updateProgress(40);
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('Syllabus file content appears to be empty or unreadable.');
      }

      await updateProgress(60);
      const chapters = await aiService.extractSyllabusChapters(pdfText);

      await updateProgress(80);
      // Delete old chapters and save new ones
      await Chapter.deleteMany({ subject: subjectId, user: req.user.id });

      const chapterDocs = chapters.map((ch, index) => ({
        user: req.user.id,
        subject: subjectId,
        name: ch.name,
        estimatedHours: ch.estimatedHours,
        order: index + 1
      }));

      const savedChapters = await Chapter.insertMany(chapterDocs);
      
      subject.totalChapters = savedChapters.length;
      await subject.save();

      // Delete the file from local uploads storage
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return {
        subjectId,
        chaptersCount: savedChapters.length
      };

    } catch (err) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw err;
    }
  });

  res.status(202).json({
    status: 'success',
    message: 'PDF uploaded successfully. Extraction has started in the background.',
    jobId: job._id
  });
});

// ─────────────────────────────────────────
// 4. AI FLASHCARD GENERATOR
// ─────────────────────────────────────────
export const aiGenerateFlashcards = catchAsync(async (req, res, next) => {
  const { subject = 'General', topic = 'Core Concepts', count = 5 } = req.body;

  const flashcards = await aiService.generateFlashcards(subject, topic, count);

  res.status(200).json({
    status: 'success',
    message: 'Flashcards generated ✅',
    subject,
    topic,
    flashcards
  });
});

// ─────────────────────────────────────────
// 5. AI INTERACTIVE PRACTICE QUIZ GENERATOR
// ─────────────────────────────────────────
export const aiGenerateQuiz = catchAsync(async (req, res, next) => {
  const { subject = 'General', topic = 'Core Concepts', difficulty = 'Medium', count = 4 } = req.body;

  const quiz = await aiService.generateQuiz(subject, topic, difficulty, count);

  res.status(200).json({
    status: 'success',
    message: 'Quiz generated ✅',
    subject,
    topic,
    quiz
  });
});

// ─────────────────────────────────────────
// 6. BEFORE EXAM MODE ROADMAP GENERATOR
// ─────────────────────────────────────────
export const aiGenerateExamMode = catchAsync(async (req, res, next) => {
  const { examDate, subjects, currentPrep, targetScore, availableHours } = req.body;

  if (!examDate || !subjects) {
    return next(new AppError('Exam date and subjects are required', 400));
  }

  const countdownPlan = await aiService.generateExamModeRoadmap(
    examDate,
    subjects,
    currentPrep,
    targetScore,
    availableHours
  );

  res.status(200).json({
    status: 'success',
    countdownPlan
  });
});

// ─────────────────────────────────────────
// 7. GET JOB STATUS (For background polling)
// ─────────────────────────────────────────
export const getJobStatus = catchAsync(async (req, res, next) => {
  const job = await Job.findOne({
    _id: req.params.jobId,
    user: req.user.id
  });

  if (!job) {
    return next(new AppError('Background job not found.', 404));
  }

  res.status(200).json({
    status: 'success',
    job: {
      id: job._id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt
    }
  });
});