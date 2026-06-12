import UserActivity from '../models/UserActivity.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { getCached, setCache } from '../utils/cache.js';
import mongoose from 'mongoose';

// Helpers for date ranges
const getDayRange = (date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
};

export const calculateDAU = async (date) => {
  const { start, end } = getDayRange(date);
  const activities = await UserActivity.aggregate([
    { $match: { timestamp: { $gte: start, $lte: end } } },
    { $group: { _id: '$userId', actions: { $push: '$action' } } },
    { $project: {
      isSession: { $in: ['session', '$actions'] },
      actionCount: { $size: '$actions' }
    }},
    { $match: { $or: [{ isSession: true }, { actionCount: { $gte: 2 } }] } }
  ]);
  return { date, count: activities.length };
};

export const calculateWAU = async (weekStartDate) => {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  
  const distinctUsers = await UserActivity.distinct('userId', { timestamp: { $gte: start, $lt: end } });
  return { weekStart: start, weekEnd: end, count: distinctUsers.length };
};

export const calculateMAU = async (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  
  const distinctUsers = await UserActivity.distinct('userId', { timestamp: { $gte: start, $lt: end } });
  return { year, month, count: distinctUsers.length };
};

export const calculateDAUWAURatio = async (date) => {
  const { start } = getDayRange(date);
  const weekStart = new Date(start);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay()); // Start of week
  
  const dau = (await calculateDAU(date)).count;
  const wau = (await calculateWAU(weekStart)).count;
  
  const ratio = wau > 0 ? dau / wau : 0;
  let interpretation = 'low';
  if (ratio >= 0.2) interpretation = 'healthy';
  else if (ratio >= 0.1) interpretation = 'moderate';
  
  return { ratio, interpretation };
};

export const getActivityBreakdown = async (startDate, endDate) => {
  const breakdown = await UserActivity.aggregate([
    { $match: { timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
    { $group: { _id: '$action', count: { $sum: 1 } } }
  ]);
  const result = { post: 0, like: 0, comment: 0, debate: 0, follow: 0, share: 0, bookmark: 0, search: 0, session: 0 };
  breakdown.forEach(b => { if (result.hasOwnProperty(b._id)) result[b._id] = b.count; });
  return result;
};

export const getTopActiveUsers = async (startDate, endDate, limit = 10) => {
  return await UserActivity.aggregate([
    { $match: { timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
    { $group: { _id: '$userId', actionCount: { $sum: 1 } } },
    { $sort: { actionCount: -1 } },
    { $limit: parseInt(limit) },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { userId: '$_id', username: '$user.username', avatar: '$user.avatar', actionCount: 1, _id: 0 } }
  ]);
};

export const getSummary = async () => {
  const cacheKey = 'analytics:summary';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split('T')[0];
  const thisWeek = new Date(); thisWeek.setUTCDate(thisWeek.getUTCDate() - thisWeek.getUTCDay());
  
  const [dau, wau, mau, ratio, breakdown, topUsers, totalUsers, totalPosts] = await Promise.all([
    calculateDAU(today),
    calculateWAU(thisWeek),
    calculateMAU(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1),
    calculateDAUWAURatio(today),
    getActivityBreakdown(thisWeek, new Date()),
    getTopActiveUsers(thisWeek, new Date()),
    User.countDocuments(),
    Post.countDocuments()
  ]);

  const summary = { today, thisWeek, thisMonth: { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 }, dau, wau, mau, dauWauRatio: ratio, activityBreakdown: breakdown, topUsers, totalUsers, totalPosts };
  setCache(cacheKey, summary, 600);
  return summary;
};
