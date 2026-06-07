import Post from '../models/Post.js';
import User from '../models/User.js';
import Field from '../models/Field.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import apiResponse from '../utils/apiResponse.js';
import { uploadImageToCloudinary, uploadVideoToMux } from '../middlewares/upload.middleware.js';
import { sendBatchEmail } from '../utils/sendEmail.js';
import sendPushNotification from '../utils/sendPushNotification.js';
import { getIO } from '../socket/socket.js';

const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try { return JSON.parse(tags); } catch { return tags.split(',').map((t) => t.trim()); }
};

export const createPost = async (req, res) => {
  try {
    const { title, body, field, tags, isPublished } = req.body;
    const authorId = req.user._id;

    const categoryField = await Field.findById(field);
    if (!categoryField) return res.status(404).json(apiResponse.error('Field category not found.'));

    const mediaUrls = [];
    if (req.files?.length > 0) {
      try {
        const results = await Promise.all(
          req.files.map((f) =>
            f.mimetype.startsWith('video/')
              ? uploadVideoToMux(f.buffer)
              : uploadImageToCloudinary(f.buffer, 'sob/posts')
          )
        );
        results.forEach((r) => mediaUrls.push(r.secure_url));
      } catch (error) {
        console.error('Media upload error:', error.message);
        return res.status(500).json(apiResponse.error('Failed to upload post media.'));
      }
    }

    const post = new Post({ author: authorId, title, body, field, tags: parseTags(tags), mediaUrls, isPublished: isPublished ?? true });
    await post.save();

    // Async: email subscribers in that field
    User.find({ emailNotifications: field, _id: { $ne: authorId } }).select('email').then((users) => {
      const emails = users.map((u) => u.email).filter(Boolean);
      if (emails.length > 0) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        sendBatchEmail(emails, `New article in ${categoryField.name}: "${title}"`,
          `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee"><h2>New Post in ${categoryField.name}</h2><h3>${title}</h3><p>${body.substring(0, 150)}...</p><a href="${clientUrl}/posts/${post._id}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block">Read Full Post</a></div>`
        );
      }
    }).catch((err) => console.error('New post email notice failure:', err.message));

    // Async: notify followers via DB + socket + push
    User.findById(authorId).populate('followers', '_id pushSubscription').then(async (authorUser) => {
      if (authorUser?.followers.length > 0) {
        const followersList = authorUser.followers.map((f) => f._id);
        await Notification.insertMany(followersList.map((fId) => ({ recipient: fId, sender: authorId, type: 'new_post', post: post._id })));
        try {
          const io = getIO();
          authorUser.followers.forEach((follower) => {
            const fId = follower._id.toString();
            // Socket notification
            io.to(fId).emit('new_notification', { type: 'new_post', post: { _id: post._id, title: post.title }, sender: { _id: authorUser._id, name: authorUser.name, username: authorUser.username, avatar: authorUser.avatar }, createdAt: new Date() });
            
            // Push notification
            if (follower.pushSubscription?.endpoint) {
              sendPushNotification(follower._id, follower.pushSubscription, {
                title: 'New Post',
                body: `${authorUser.name} published a new post: ${post.title}`,
                url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/posts/${post._id}`
              });
            }
          });
        } catch {}
      }
    }).catch((err) => console.error('New post follower notice failure:', err.message));

    return res.status(201).json(apiResponse.success('Post created successfully.', { post }));
  } catch (error) {
    console.error('Create Post Error:', error.message);
    return res.status(500).json(apiResponse.error('Internal server error creating post.'));
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const total = await Post.countDocuments({ isPublished: true });
    const posts = await Post.find({ isPublished: true }).populate('author', 'name username avatar bio').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('Posts retrieved successfully.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting posts.'));
  }
};

export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name username avatar bio').populate('field', 'name slug');
    if (!post) return res.status(404).json(apiResponse.error('Post not found.'));
    return res.status(200).json(apiResponse.success('Post retrieved successfully.', { post }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting post details.'));
  }
};

export const editPost = async (req, res) => {
  try {
    const { title, body, field, tags, isPublished } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json(apiResponse.error('Post not found.'));
    if (post.author.toString() !== req.user._id.toString()) return res.status(403).json(apiResponse.error('Forbidden: You are not authorized to edit this post.'));

    if (title) post.title = title;
    if (body) post.body = body;
    if (isPublished !== undefined) post.isPublished = isPublished;
    if (field) { const f = await Field.findById(field); if (!f) return res.status(404).json(apiResponse.error('Invalid field category.')); post.field = field; }
    if (tags) post.tags = parseTags(tags);

    if (req.files?.length > 0) {
      try {
        const results = await Promise.all(
          req.files.map((f) =>
            f.mimetype.startsWith('video/')
              ? uploadVideoToMux(f.buffer)
              : uploadImageToCloudinary(f.buffer, 'sob/posts')
          )
        );
        results.forEach((r) => post.mediaUrls.push(r.secure_url));
      } catch (error) {
        console.error('Media upload error:', error.message);
        return res.status(500).json(apiResponse.error('Failed to upload new media.'));
      }
    }

    await post.save();
    return res.status(200).json(apiResponse.success('Post updated successfully.', { post }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error during post edit.'));
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json(apiResponse.error('Post not found.'));
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json(apiResponse.error('Forbidden: You are not authorized to delete this post.'));
    }
    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ post: req.params.id });
    await Notification.deleteMany({ post: req.params.id });
    return res.status(200).json(apiResponse.success('Post and all associated comments deleted successfully.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error deleting post.'));
  }
};

export const toggleLikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'pushSubscription name');
    if (!post) return res.status(404).json(apiResponse.error('Post not found.'));

    const isLiked = post.likes.includes(req.user._id);
    if (isLiked) { post.likes.pull(req.user._id); }
    else {
      post.likes.push(req.user._id);
      if (post.author._id.toString() !== req.user._id.toString()) {
        const notification = new Notification({ recipient: post.author._id, sender: req.user._id, type: 'like', post: post._id });
        await notification.save();
        try { 
          getIO().to(post.author._id.toString()).emit('new_notification', { _id: notification._id, type: 'like', post: { _id: post._id, title: post.title }, sender: { _id: req.user._id, name: req.user.name, username: req.user.username, avatar: req.user.avatar }, createdAt: notification.createdAt }); 
          
          if (post.author.pushSubscription?.endpoint) {
            sendPushNotification(post.author._id, post.author.pushSubscription, {
              title: 'New Like',
              body: `${req.user.name} liked your post: ${post.title}`,
              url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/posts/${post._id}`
            });
          }
        } catch {}
      }
    }
    await post.save();
    return res.status(200).json(apiResponse.success(isLiked ? 'Post unliked.' : 'Post liked.', { likesCount: post.likes.length, isLiked: !isLiked }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error liking post.'));
  }
};

export const toggleBookmarkPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json(apiResponse.error('Post not found.'));
    const isBookmarked = post.bookmarks.includes(req.user._id);
    if (isBookmarked) { post.bookmarks.pull(req.user._id); } else { post.bookmarks.push(req.user._id); }
    await post.save();
    return res.status(200).json(apiResponse.success(isBookmarked ? 'Removed from bookmarks.' : 'Post bookmarked.', { isBookmarked: !isBookmarked }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error bookmarking post.'));
  }
};

export const sharePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true });
    if (!post) return res.status(404).json(apiResponse.error('Post not found.'));
    return res.status(200).json(apiResponse.success('Post share count incremented.', { shares: post.shares }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error sharing post.'));
  }
};

export const getPostsByUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const total = await Post.countDocuments({ author: req.params.userId, isPublished: true });
    const posts = await Post.find({ author: req.params.userId, isPublished: true }).populate('author', 'name username avatar').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('User posts retrieved.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting user posts.'));
  }
};
