import mongoose from 'mongoose';

const NotificationDeliverySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  reminderType: {
    type: String,
    enum: ['exam_reminder', 'study_reminder'],
    required: true
  },
  scheduledDate: {
    type: String, // format: YYYY-MM-DD
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'claimed', 'sent', 'failed'],
    default: 'pending'
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Compound unique index ensuring exact per-recipient, per-reminder-type, and scheduled date idempotence
NotificationDeliverySchema.index(
  { user: 1, subject: 1, task: 1, reminderType: 1, scheduledDate: 1 },
  { unique: true }
);

export default mongoose.models.NotificationDelivery || mongoose.model('NotificationDelivery', NotificationDeliverySchema);
