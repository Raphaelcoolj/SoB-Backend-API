import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Field from '../models/Field.js';
import Notification from '../models/Notification.js';
import apiResponse from '../utils/apiResponse.js';
import { sendBatchEmail } from '../utils/sendEmail.js';

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const total = await User.countDocuments();
    const users = await User.find().select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('All users retrieved.', { users }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error retrieving users.'));
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json(apiResponse.error('Invalid role. Allowed: user, admin.'));

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json(apiResponse.error('User not found.'));
    if (user._id.toString() === req.user._id.toString()) return res.status(400).json(apiResponse.error('You cannot change your own role.'));

    user.role = role;
    await user.save();
    return res.status(200).json(apiResponse.success(`User role updated to ${role}.`, { user: { _id: user._id, role: user.role, name: user.name, username: user.username } }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error updating user role.'));
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId === req.user._id.toString()) return res.status(400).json(apiResponse.error('Cannot delete your own admin account via this endpoint.'));

    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json(apiResponse.error('User not found.'));

    await User.updateMany({}, { $pull: { followers: userId, following: userId } });
    const userPosts = await Post.find({ author: userId });
    const postIds = userPosts.map((p) => p._id);
    await Comment.deleteMany({ post: { $in: postIds } });
    await Post.deleteMany({ author: userId });
    await Comment.deleteMany({ author: userId });
    await Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] });

    return res.status(200).json(apiResponse.success('User and all associated records deleted by Admin.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error deleting user.'));
  }
};

export const getAllPostsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const total = await Post.countDocuments();
    const posts = await Post.find().populate('author', 'name username email').populate('field', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json(apiResponse.success('Admin: All posts retrieved.', { posts }, { page, limit, total }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error retrieving posts.'));
  }
};

export const broadcastEmail = async (req, res) => {
  try {
    const { subject, body } = req.body;
    const users = await User.find({}).select('email');
    const emails = users.map((u) => u.email).filter(Boolean);
    if (emails.length === 0) return res.status(400).json(apiResponse.error('No users found to email.'));

    const htmlBody = `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:8px"><h2 style="color:#333;border-bottom:2px solid #007bff;padding-bottom:10px">Message from SoB Administration</h2><div style="font-size:16px;color:#555;line-height:1.6;margin-top:20px">${body.replace(/\n/g, '<br />')}</div></div>`;

    sendBatchEmail(emails, subject, htmlBody)
      .then(() => console.log('Admin broadcast complete.'))
      .catch((err) => console.error('Admin broadcast failure:', err.message));

    return res.status(200).json(apiResponse.success(`Broadcast initialized to ${emails.length} users in the background.`));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error launching broadcast.'));
  }
};

export const getStats = async (req, res) => {
  try {
    const [usersCount, postsCount, fieldsCount, commentsCount] = await Promise.all([
      User.countDocuments(), Post.countDocuments(), Field.countDocuments(), Comment.countDocuments(),
    ]);
    return res.status(200).json(apiResponse.success('Platform stats retrieved.', { users: usersCount, posts: postsCount, fields: fieldsCount, comments: commentsCount }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error compiling stats.'));
  }
};
