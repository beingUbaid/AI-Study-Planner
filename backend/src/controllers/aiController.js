import fs from 'fs';
import Subject from '../models/Subject.js';
import Chapter from '../models/Chapter.js';
import TopicTest from '../models/TopicTest.js';
import StudyPlan from '../models/StudyPlan.js';
import logger from '../utils/logger.js';
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
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new AppError('Subject not found', 404));
  }

  let pdfText = '';
  try {
    // Limit uploaded file size to 5MB
    if (req.file.size > 5 * 1024 * 1024) {
      return next(new AppError('PDF exceeds 5MB size limit.', 400));
    }

    // Extract text from document
    pdfText = await extractTextFromPDF(req.file.path);
    if (!pdfText || pdfText.trim().length === 0) {
      return next(new AppError('Syllabus file content appears empty or unreadable.', 400));
    }

    // Extracted text length limit (max 50,000 characters)
    if (pdfText.length > 50000) {
      return next(new AppError('Syllabus content exceeds the limit of 50,000 characters.', 400));
    }
  } catch (err) {
    logger.error('Failed to parse uploaded PDF:', err);
    return next(new AppError('Failed to parse uploaded PDF document.', 400));
  } finally {
    // Guaranteed cleanup of temp files in finally blocks
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }

  // Create a background job for parsing syllabus
  const job = await queueService.createJob(req.user.id, 'syllabus_extraction');

  // Enqueue job asynchronously (closure captures pdfText safely)
  queueService.enqueue(job._id, async (updateProgress) => {
    await updateProgress(30);
    const chapters = await aiService.extractSyllabusChapters(pdfText);

    await updateProgress(60);
    // Delete old chapters and save new ones
    await Chapter.deleteMany({ subject: subjectId, user: req.user.id });

    const chapterDocs = chapters.map((ch, index) => ({
      user: req.user.id,
      subject: subjectId,
      name: ch.name,
      estimatedHours: ch.estimatedHours,
      order: index + 1
    }));

    await updateProgress(80);
    const savedChapters = await Chapter.insertMany(chapterDocs);
    
    subject.totalChapters = savedChapters.length;
    await subject.save();

    return {
      subjectId,
      chaptersCount: savedChapters.length
    };
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

  // Verify resource ownership if subject is specified
  if (subject !== 'General') {
    const ownedSubject = await Subject.findOne({ name: subject, user: req.user.id });
    if (!ownedSubject) {
      return next(new AppError('Subject not found or access denied.', 403));
    }
  }

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

  // Verify resource ownership if subject is specified
  if (subject !== 'General') {
    const ownedSubject = await Subject.findOne({ name: subject, user: req.user.id });
    if (!ownedSubject) {
      return next(new AppError('Subject not found or access denied.', 403));
    }
  }

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

// ─────────────────────────────────────────
// 8. SAVE TOPIC TEST & GENERATE WEAKNESS ANALYSIS
// ─────────────────────────────────────────
export const saveTopicTest = catchAsync(async (req, res, next) => {
  const { subjectName, topic, difficulty = 'Medium', questions = [] } = req.body;

  if (!subjectName || !topic || !questions || questions.length === 0) {
    return next(new AppError('Please provide subjectName, topic, and test questions', 400));
  }

  // Calculate score & filter incorrect questions
  let correctCount = 0;
  const evaluatedQuestions = questions.map(q => {
    const isCorrect = q.userAnswer === q.correctAnswer;
    if (isCorrect) correctCount++;
    return {
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: q.userAnswer !== undefined ? q.userAnswer : -1,
      explanation: q.explanation || ''
    };
  });

  const totalQuestions = questions.length;
  const score = Math.round((correctCount / totalQuestions) * 100);

  // Identify incorrect questions for weakness analysis
  const incorrectQuestions = evaluatedQuestions.filter(q => q.userAnswer !== q.correctAnswer);

  // Call AI weakness analysis service
  const weaknessAnalysis = await aiService.generateWeaknessAnalysis(
    subjectName,
    topic,
    incorrectQuestions
  );

  const topicTest = await TopicTest.create({
    user: req.user.id,
    subjectName,
    topic,
    score,
    totalQuestions,
    difficulty,
    weaknessAnalysis,
    questions: evaluatedQuestions
  });

  res.status(201).json({
    status: 'success',
    message: 'Topic test saved and analyzed successfully ✅',
    topicTest
  });
});

// ─────────────────────────────────────────
// 9. GET ALL TOPIC TESTS (HISTORY)
// ─────────────────────────────────────────
export const getTopicTests = catchAsync(async (req, res, next) => {
  const topicTests = await TopicTest.find({ user: req.user.id }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    count: topicTests.length,
    topicTests
  });
});

// ─────────────────────────────────────────
// 10. GET TOPIC TEST DETAILS BY ID
// ─────────────────────────────────────────
export const getTopicTestById = catchAsync(async (req, res, next) => {
  const topicTest = await TopicTest.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!topicTest) {
    return next(new AppError('Topic test result not found or access denied.', 404));
  }

  res.status(200).json({
    status: 'success',
    topicTest
  });
});