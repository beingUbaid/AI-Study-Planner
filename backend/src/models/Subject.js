import mongoose from 'mongoose'

const SubjectSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  examDate: {
    type: Date,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  totalChapters: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#667eea'
  },
  quizPerformance: [{
    date: {
      type: Date,
      default: Date.now
    },
    topic: String,
    score: Number,
    difficulty: String
  }]
}, { timestamps: true })

export default mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);