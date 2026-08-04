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
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid date format YYYY-MM-DD!`
    }
  },
  status: {
    type: String,
    enum: ['pending', 'claimed', 'sent', 'failed'],
    default: 'pending'
  },
  attempts: {
    type: Number,
    default: 0,
    min: [0, 'Attempts cannot be negative']
  },
  claimedAt: {
    type: Date,
    default: null
  },
  claimExpiresAt: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  lastErrorCode: {
    type: String,
    default: null
  },
  lastError: {
    type: String,
    default: null
  },
  nextRetryAt: {
    type: Date,
    default: null
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });

// Pre-validate middleware to compute the deterministic idempotencyKey (Synchronous)
NotificationDeliverySchema.pre('validate', function() {
  const u = this.user ? this.user.toString() : '';
  const s = this.subject ? this.subject.toString() : 'null';
  const t = this.task ? this.task.toString() : 'null';
  const r = this.reminderType || '';
  const d = this.scheduledDate || '';
  this.idempotencyKey = `${u}:${s}:${t}:${r}:${d}`;
});

// Pre-save middleware to enforce controlled status transitions (Synchronous)
NotificationDeliverySchema.pre('save', function() {
  if (this.isNew) {
    if (this.status !== 'pending' && this.status !== 'claimed') {
      throw new Error(`New notification delivery cannot start with status: ${this.status}`);
    }
  } else if (this.isModified('status')) {
    const prev = this._originalStatus || 'pending';
    const nextVal = this.status;
    const allowedTransitions = {
      pending: ['claimed'],
      claimed: ['sent', 'failed'],
      failed: ['claimed'],
      sent: [] // Sent is terminal
    };
    if (prev !== nextVal && !(allowedTransitions[prev] && allowedTransitions[prev].includes(nextVal))) {
      throw new Error(`Invalid status transition from ${prev} to ${nextVal}`);
    }
  }
});

NotificationDeliverySchema.post('init', function(doc) {
  doc._originalStatus = doc.status;
});

NotificationDeliverySchema.post('save', function(doc) {
  doc._originalStatus = doc.status;
});

// Compound unique index: one delivery record per user x reminderType x scheduledDate
// Preserve the compound index but make it a partial index or keep it to safeguard against duplicates
NotificationDeliverySchema.index(
  { user: 1, subject: 1, task: 1, reminderType: 1, scheduledDate: 1 },
  { unique: true }
);

// Indexes for workers to query efficiently
NotificationDeliverySchema.index({ idempotencyKey: 1 }, { unique: true });
NotificationDeliverySchema.index({ status: 1, nextRetryAt: 1 });
NotificationDeliverySchema.index({ status: 1, claimExpiresAt: 1 });

export default mongoose.models.NotificationDelivery ||
  mongoose.model('NotificationDelivery', NotificationDeliverySchema);
