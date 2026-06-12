import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import apiResponse from '../utils/apiResponse.js';
import sendPushNotification from '../utils/sendPushNotification.js';
import { getIO } from '../socket/socket.js';
import { logActivity } from '../services/activity.service.js';

const cascadeDeleteComments = async (commentId) => {
  const replies = await Comment.find({ parentComment: commentId });
  for (const reply of replies) await cascadeDeleteComments(reply._id);
  await Comment.findByIdAndDelete(commentId);
  await Notification.deleteMany({ comment: commentId });
};

export const createComment = async (req, res) => {
  try {
    const { post: postId, body, type, parentComment } = req.body;
    const authorId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json(apiResponse.error('Target post not found.'));

    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) return res.status(404).json(apiResponse.error('Parent comment not found.'));
    }

    const comment = new Comment({ post: postId, author: authorId, body, type: type || 'comment', parentComment: parentComment || null });
    await comment.save();
    post.comments.push(comment._id);
    await post.save();
    logActivity(authorId, type === 'debate' ? 'debate' : 'comment');

    const populatedComment = await Comment.findById(comment._id).populate('author', 'name username avatar');

    let recipientId = null;
    const notificationType = type === 'debate' ? 'debate' : 'comment';

    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (parent?.author.toString() !== authorId.toString()) recipientId = parent.author;
    } else if (post.author.toString() !== authorId.toString()) {
      recipientId = post.author;
    }

    if (recipientId) {
      const notification = new Notification({ recipient: recipientId, sender: authorId, type: notificationType, post: postId });
      await notification.save();
      try {
        getIO().to(recipientId.toString()).emit('new_notification', {
          _id: notification._id, type: notificationType, post: { _id: post._id, title: post.title },
          sender: { _id: req.user._id, name: req.user.name, username: req.user.username, avatar: req.user.avatar }, createdAt: notification.createdAt,
        });

        // Send push notification
        const recipient = await User.findById(recipientId).select('pushSubscription');
        if (recipient?.pushSubscription?.endpoint) {
          sendPushNotification(recipient._id, recipient.pushSubscription, {
            title: notificationType === 'debate' ? 'New Debate' : 'New Comment',
            body: `${req.user.name} ${notificationType === 'debate' ? 'started a debate' : 'commented'} on your ${parentComment ? 'comment' : 'post'}`,
            url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/posts/${postId}`
          });
        }
      } catch {}
    }

    try {
      getIO().to(`post_${postId}`).emit(type === 'debate' ? 'new_debate' : 'new_comment', { comment: populatedComment });
    } catch {}

    return res.status(201).json(apiResponse.success('Comment created successfully.', { comment: populatedComment }));
  } catch (error) {
    console.error('Create Comment Error:', error.message);
    return res.status(500).json(apiResponse.error('Internal server error creating comment.'));
  }
};

export const getCommentsByPost = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId, parentComment: null }).populate('author', 'name username avatar').sort({ createdAt: 1 });
    return res.status(200).json(apiResponse.success('Comments retrieved successfully.', { comments }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting comments.'));
  }
};

export const getCommentReplies = async (req, res) => {
  try {
    const replies = await Comment.find({ parentComment: req.params.id }).populate('author', 'name username avatar').sort({ createdAt: 1 });
    return res.status(200).json(apiResponse.success('Comment replies retrieved.', { replies }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting replies.'));
  }
};

export const editComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json(apiResponse.error('Comment not found.'));
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json(apiResponse.error('Forbidden: You are not authorized to edit this comment.'));
    }
    comment.body = req.body.body;
    await comment.save();
    const populated = await Comment.findById(comment._id).populate('author', 'name username avatar');
    return res.status(200).json(apiResponse.success('Comment updated successfully.', { comment: populated }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error editing comment.'));
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json(apiResponse.error('Comment not found.'));
    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json(apiResponse.error('Forbidden: You are not authorized to delete this comment.'));
    }
    await Post.findByIdAndUpdate(comment.post, { $pull: { comments: req.params.id } });
    await cascadeDeleteComments(req.params.id);
    return res.status(200).json(apiResponse.success('Comment and all replies deleted successfully.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error deleting comment.'));
  }
};

export const toggleLikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json(apiResponse.error('Comment not found.'));
    const isLiked = comment.likes.includes(req.user._id);
    if (isLiked) { comment.likes.pull(req.user._id); } else { comment.likes.push(req.user._id); }
    await comment.save();
    return res.status(200).json(apiResponse.success(isLiked ? 'Comment unliked.' : 'Comment liked.', { likesCount: comment.likes.length, isLiked: !isLiked }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error liking comment.'));
  }
};
