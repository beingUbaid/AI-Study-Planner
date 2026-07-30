import Subject from "../models/Subject.js";
import { catchAsync } from "../middleware/errorMiddleware.js";
import AppError from "../utils/appError.js";

// Add Subject
export const addSubject = catchAsync(async (req, res, next) => {
  const { name, examDate, difficulty, color } = req.body;
  if (!name || !examDate) {
    return next(new AppError("Name and exam date are required", 400));
  }

  const existing = await Subject.findOne({
    user: req.user.id,
    name: name.trim(),
  });

  if (existing) {
    return next(new AppError("Subject already exists", 400));
  }

  const subject = await Subject.create({
    user: req.user.id,
    name: name.trim(),
    examDate,
    difficulty: difficulty || "Medium",
    color: color || "#667eea",
  });

  res.status(201).json({
    status: "success",
    message: "Subject added successfully ✅",
    subject,
  });
});

// Get All Subjects for User
export const getSubjects = catchAsync(async (req, res, next) => {
  const subjects = await Subject.find({ user: req.user.id }).sort({
    examDate: 1,
  });

  const subjectsWithDays = subjects.map((subject) => {
    const today = new Date();
    const exam = new Date(subject.examDate);
    const daysRemaining = Math.ceil((exam - today) / (1000 * 60 * 60 * 24));
    return {
      ...subject.toObject(),
      daysRemaining,
    };
  });

  res.status(200).json({
    status: "success",
    message: "Subjects fetched ✅",
    count: subjects.length,
    subjects: subjectsWithDays,
  });
});

// Update Subject
export const updateSubject = catchAsync(async (req, res, next) => {
  const { name, examDate, difficulty, color } = req.body;

  const subject = await Subject.findOne({
    _id: req.params.id,
    user: req.user.id, // Strictly verify resource ownership
  });

  if (!subject) {
    return next(new AppError("Subject not found or access denied.", 404));
  }

  if (name) subject.name = name;
  if (examDate) subject.examDate = examDate;
  if (difficulty) subject.difficulty = difficulty;
  if (color) subject.color = color;

  await subject.save();

  res.status(200).json({
    status: "success",
    message: "Subject updated ✅",
    subject,
  });
});

// Delete Subject
export const deleteSubject = catchAsync(async (req, res, next) => {
  const subject = await Subject.findOne({
    _id: req.params.id,
    user: req.user.id, // Strictly verify resource ownership
  });

  if (!subject) {
    return next(new AppError("Subject not found or access denied.", 404));
  }

  await subject.deleteOne();

  res.status(200).json({
    status: "success",
    message: "Subject deleted ✅",
  });
});

// Log Quiz Performance
export const logQuizScore = catchAsync(async (req, res, next) => {
  const { score, topic, difficulty } = req.body;
  const lookupId = req.params.id;

  const query = { user: req.user.id }; // Strictly verify resource ownership
  if (lookupId.match(/^[0-9a-fA-F]{24}$/)) {
    query._id = lookupId;
  } else {
    query.name = new RegExp(`^${lookupId.trim()}$`, "i");
  }

  const subject = await Subject.findOne(query);

  if (!subject) {
    return next(new AppError("Subject not found or access denied.", 404));
  }

  subject.quizPerformance = subject.quizPerformance || [];
  subject.quizPerformance.push({
    date: new Date(),
    topic: topic || "Practice Quiz",
    score: score !== undefined ? score : 0,
    difficulty: difficulty || "Medium",
  });

  await subject.save();

  res.status(200).json({
    status: "success",
    message: "Quiz performance logged successfully ✅",
    subject,
  });
});