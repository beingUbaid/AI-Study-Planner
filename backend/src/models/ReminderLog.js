import mongoose from 'mongoose';

const ReminderLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentDate: {
    type: String, // format: YYYY-MM-DD
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'claimed', 'success', 'failed'],
    default: 'pending'
  },
  attempts: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Compound unique index ensuring at most ONE reminder sent per user per day!
ReminderLogSchema.index({ userId: 1, sentDate: 1 }, { unique: true });

export default mongoose.models.ReminderLog || mongoose.model('ReminderLog', ReminderLogSchema);
