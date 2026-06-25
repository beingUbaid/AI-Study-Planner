import mongoose from 'mongoose'

const TaskSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  subjectName: String,
  subjectColor: String,
  chapter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter'
  },
  chapterName: String,
  estimatedHours: Number,
  isCompleted: {
    type: Boolean,
    default: false
  },
  isRevision: {
    type: Boolean,
    default: false
  }
})

const DaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  dayName: String,
  tasks: [TaskSchema],
  totalHours: {
    type: Number,
    default: 0
  },
  isBreakDay: {
    type: Boolean,
    default: false
  }
})

const StudyPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: Date,
  dailyStudyHours: Number,
  schedule: [DaySchema]
}, { timestamps: true })

export default mongoose.model('StudyPlan', StudyPlanSchema)