import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Post author is required'] },
    title: { type: String, required: [true, 'Post title is required'], trim: true },
    body: { type: String, required: [true, 'Post body content is required'] },
    mediaUrls: { type: [String], default: [] },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: [true, 'Post field is required'] },
    tags: { type: [String], default: [] },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    shares: { type: Number, default: 0 },
    bookmarks: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    comments: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Post = mongoose.model('Post', postSchema);
export default Post;
