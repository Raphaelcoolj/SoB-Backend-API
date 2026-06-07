import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Recipient is required'] },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Sender is required'] },
    type: { type: String, enum: ['like', 'comment', 'follow', 'debate', 'new_post'], required: [true, 'Type is required'] },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
