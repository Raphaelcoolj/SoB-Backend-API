import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: [true, 'Comment post reference is required'] },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Comment author is required'] },
    body: { type: String, required: [true, 'Comment body is required'], trim: true },
    type: { type: String, enum: ['comment', 'debate'], default: 'comment' },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true }
);

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
