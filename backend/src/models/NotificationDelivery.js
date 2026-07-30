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
    type: String, // format: YYYY-MM-DD — deterministic key for idempotency
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
  // Populated when a worker claims this record
  claimedAt: {
    type: Date,
    default: null
  },
  // When this claim expires — used for stale-claim recovery after worker crash
  claimExpiresAt: {
    type: Date,
    default: null
  },
  // Populated once delivery succeeds
  sentAt: {
    type: Date,
    default: null
  },
  // Sanitized error message — never contains PII (no emails, IPs, or tokens)
  lastError: {
    type: String,
    default: null
  },
  // Next eligible retry time — exponential backoff
  nextRetryAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Compound unique index: one delivery record per user × reminderType × scheduledDate
// subject and task default null so they participate in uniqueness correctly
NotificationDeliverySchema.index(
  { user: 1, subject: 1, task: 1, reminderType: 1, scheduledDate: 1 },
  { unique: true }
);

// Index for worker queries: find pending/failed retries and stale claims efficiently
NotificationDeliverySchema.index({ status: 1, nextRetryAt: 1 });
NotificationDeliverySchema.index({ status: 1, claimExpiresAt: 1 });

export default mongoose.models.NotificationDelivery ||
  mongoose.model('NotificationDelivery', NotificationDeliverySchema);
