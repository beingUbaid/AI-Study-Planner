import mongoose from 'mongoose';

const LockSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  expireAt: {
    type: Date,
    required: true
  }
});

// Configure TTL index to automatically delete lock records once expired
LockSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Lock || mongoose.model('Lock', LockSchema);
