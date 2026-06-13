// NEW: src/scripts/cleanSeed.js
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import UserActivity from '../models/UserActivity.js';

const start = Date.now();

const clean = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all seed user IDs
    const seedUsers = await User.find({ email: /@test.com$/ }).select('_id');
    const seedUserIds = seedUsers.map(u => u._id);
    
    if (seedUserIds.length === 0) {
      console.log('No seed users found. Nothing to clean.');
      process.exit(0);
    }

    // 1. Delete Notifications
    await Notification.deleteMany({ $or: [{ sender: { $in: seedUserIds } }, { recipient: { $in: seedUserIds } }] });
    console.log('✅ Notifications cleaned');

    // 2. Delete Activities
    await UserActivity.deleteMany({ userId: { $in: seedUserIds } });
    console.log('✅ Activity cleaned');

    // 3. Delete Comments
    await Comment.deleteMany({ author: { $in: seedUserIds } });
    console.log('✅ Comments cleaned');

    // 4. Delete Posts
    await Post.deleteMany({ author: { $in: seedUserIds } });
    console.log('✅ Posts cleaned');

    // 5. Delete Users
    await User.deleteMany({ email: /@test.com$/ });
    console.log('✅ Users cleaned');

    console.log(`✅ Cleanup complete in ${((Date.now() - start) / 1000).toFixed(2)}s`);
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning seed data:', error);
    process.exit(1);
  }
};

clean();
