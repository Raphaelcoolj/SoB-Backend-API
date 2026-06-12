import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Post author is required'] },
    contentType: {
      type: String,
      enum: ['article', 'post'],
      required: true,
      default: 'post'
    },
    title: { 
      type: String, 
      trim: true,
      required: function () { return this.contentType === 'article'; }
    },
    body: { type: String, required: [true, 'Post body content is required'] },
    mediaUrls: { type: [String], default: [] },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: [true, 'Post field is required'] },
    tags: { type: [String], default: [] },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    shares: { type: Number, default: 0 },
    bookmarks: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    comments: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }], default: [] },
    isPublished: { type: Boolean, default: true },
    // IMPROVED: Added media IDs and impressions tracking
    muxAssetId: String,
    muxPlaybackId: String,
    cloudinaryPublicIds: { type: [String], default: [] },
    impressions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// IMPROVED: Added optimized indexes
postSchema.index({ field: 1, createdAt: -1 });
postSchema.index({ contentType: 1, field: 1, createdAt: -1 });
postSchema.index({ author: 1 });

const Post = mongoose.model('Post', postSchema);
export default Post;
