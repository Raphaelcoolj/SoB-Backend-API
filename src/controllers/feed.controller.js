import Post from '../models/Post.js';
import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';

export const getForYouFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const user = await User.findById(req.user._id);
    const priorityFields = user.priorityFields || [];
    const query = priorityFields.length > 0 ? { field: { $in: priorityFields }, isPublished: true } : { isPublished: true };
    const total = await Post.countDocuments(query);
    const posts = await Post.find(query).populate('author', 'name username avatar bio').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('For-You-Feed retrieved successfully.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting For-You-Feed.'));
  }
};

export const getLatestPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const total = await Post.countDocuments({ isPublished: true });
    const posts = await Post.find({ isPublished: true }).populate('author', 'name username avatar bio').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('Latest posts retrieved.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting latest posts.'));
  }
};

export const getPostsByField = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const query = { field: req.params.fieldId, isPublished: true };
    const total = await Post.countDocuments(query);
    const posts = await Post.find(query).populate('author', 'name username avatar bio').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('Field posts retrieved.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting field posts.'));
  }
};
