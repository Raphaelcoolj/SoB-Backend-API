import UserActivity from '../models/UserActivity.js';

/**
 * Log a user action - fire-and-forget
 * @param {string|mongoose.Types.ObjectId} userId 
 * @param {string} action 
 */
export const logActivity = (userId, action) => {
  const activity = new UserActivity({ userId, action });
  activity.save().catch(err => console.error('Activity logging failed:', err.message));
};
