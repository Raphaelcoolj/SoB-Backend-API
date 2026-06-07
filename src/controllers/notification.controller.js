import Notification from '../models/Notification.js';
import apiResponse from '../utils/apiResponse.js';

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name username avatar').populate('post', 'title').sort({ createdAt: -1 });
    return res.status(200).json(apiResponse.success('Notifications retrieved successfully.', { notifications }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting notifications.'));
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json(apiResponse.error('Notification not found.'));
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json(apiResponse.error('Forbidden: Not authorized to update this notification.'));
    }
    notification.isRead = true;
    await notification.save();
    return res.status(200).json(apiResponse.success('Notification marked as read.', { notification }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error updating notification.'));
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true } });
    return res.status(200).json(apiResponse.success('All notifications marked as read.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error marking notifications read.'));
  }
};
