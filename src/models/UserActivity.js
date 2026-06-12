import mongoose from 'mongoose';

const UserActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: ['session', 'post', 'like', 'comment', 'debate', 'follow', 'share', 'bookmark', 'search'],
    required: true
  },
  timestamp: { type: Date, default: Date.now }
});

// NEW: Indexes for query performance and TTL
UserActivitySchema.index({ userId: 1, timestamp: -1 });
UserActivitySchema.index({ timestamp: -1 });
// TTL - auto delete activity logs older than 90 days
UserActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

const UserActivity = mongoose.model('UserActivity', UserActivitySchema);
export default UserActivity;
