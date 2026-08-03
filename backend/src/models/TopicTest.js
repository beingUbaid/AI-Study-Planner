import mongoose from 'mongoose';

const TopicTestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subjectName: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  weaknessAnalysis: {
    type: String,
    default: ''
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    options: [{
      type: String,
      required: true
    }],
    correctAnswer: {
      type: Number,
      required: true
    },
    userAnswer: {
      type: Number,
      default: -1 // -1 means skipped
    },
    explanation: {
      type: String,
      default: ''
    }
  }]
}, { timestamps: true });

TopicTestSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.TopicTest || mongoose.model("TopicTest", TopicTestSchema);
