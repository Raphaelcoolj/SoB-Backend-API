import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Recipient is required'] },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Sender is required'] },
    type: { type: String, enum: ['like', 'comment', 'follow', 'debate', 'new_post'], required: [true, 'Type is required'] },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    isRead: { type: Boolean, default: false },
    // IMPROVED: Explicitly define createdAt with TTL index (30 days)
    createdAt: { type: Date, default: Date.now, expires: '30d' },
  },
  { timestamps: false } // IMPROVED: Using manual createdAt for TTL index
);

// IMPROVED: Added optimized index for recipient queries
notificationSchema.index({ recipient: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
