import Post from '../models/Post.js';
import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';
import { logActivity } from '../services/activity.service.js';

export const searchPosts = async (req, res) => {
  try {
    const queryStr = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!queryStr.trim()) return res.status(200).json(apiResponse.success('Search query is empty.', { posts: [] }, { page, limit, total: 0 }));

    const searchQuery = { isPublished: true, $or: [{ title: { $regex: queryStr, $options: 'i' } }, { body: { $regex: queryStr, $options: 'i' } }, { tags: { $in: [new RegExp(queryStr, 'i')] } }] };
    const total = await Post.countDocuments(searchQuery);
    const posts = await Post.find(searchQuery).populate('author', 'name username avatar').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('Post search completed.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error during post search.'));
  }
};

export const searchUsers = async (req, res) => {
  try {
    const queryStr = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!queryStr.trim()) return res.status(200).json(apiResponse.success('Search query is empty.', { users: [] }, { page, limit, total: 0 }));

    const searchQuery = { $or: [{ name: { $regex: queryStr, $options: 'i' } }, { username: { $regex: queryStr, $options: 'i' } }] };
    const total = await User.countDocuments(searchQuery);
    const users = await User.find(searchQuery).select('name username avatar bio followers following').skip(skip).limit(limit);
    
    const currentUser = req.user;
    const followingSet = currentUser
      ? new Set(currentUser.following.map((id) => id.toString()))
      : new Set();

    const usersWithStatus = users.map((u) => {
      const uObj = u.toObject();
      return {
        ...uObj,
        isFollowing: followingSet.has(u._id.toString()),
      };
    });

    if (users.length > 0 && currentUser) logActivity(currentUser._id, 'search');
    return res.status(200).json(apiResponse.success('User search completed.', { users: usersWithStatus }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error during user search.'));
  }
};
