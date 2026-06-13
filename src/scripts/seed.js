// NEW: src/scripts/seed.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Field from '../models/Field.js';
import Notification from '../models/Notification.js';
import UserActivity from '../models/UserActivity.js';

const start = Date.now();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
};

const seed = async () => {
  try {
    await connectDB();

    // 1. Seed Fields
    const fieldCount = await Field.countDocuments();
    let fields = [];
    if (fieldCount === 0) {
      const fieldNames = ['Technology', 'Science', 'Medicine', 'Law', 'Business', 'Arts', 'Mathematics', 'History', 'Philosophy', 'Engineering'];
      fields = await Field.insertMany(fieldNames.map(name => ({ name, slug: name.toLowerCase() })));
      console.log('✅ 10 default fields created');
    } else {
      fields = await Field.find();
      console.log('✅ Fields already exist, skipping seeding');
    }

    // 2. Seed Users
    console.log('Starting to generate 1000 users...');
    const users = [];
    for (let i = 0; i < 1000; i++) {
      if (i % 200 === 0) console.log(`Generating user ${i}...`);
      const password = await bcrypt.hash('Test1234!', 12);
      users.push({
        name: faker.person.fullName(),
        username: `${faker.internet.username()}${i}`,
        email: `seeduser${i}@test.com`,
        password,
        isVerified: true,
        isOnboarded: true,
        bio: faker.lorem.sentence(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
        dob: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
        priorityFields: faker.helpers.arrayElements(fields.map(f => f._id), 5),
        emailNotifications: faker.helpers.arrayElements(fields.map(f => f._id), 3),
        role: 'user'
      });
    }
    console.log('Inserting 1000 users...');
    const createdUsers = await User.insertMany(users);
    console.log('✅ 1000 users created');

    // 3. Follow relationships
    for (const user of createdUsers) {
      const numFollows = Math.floor(Math.random() * 20) + 10;
      const following = faker.helpers.arrayElements(createdUsers.map(u => u._id), numFollows);
      user.following = following.filter(id => id.toString() !== user._id.toString());
      await user.save();
    }
    console.log('✅ Follow relationships created');

    // 4. Posts
    const posts = [];
    for (let i = 0; i < 2000; i++) {
      const author = faker.helpers.arrayElement(createdUsers);
      const contentType = Math.random() > 0.4 ? 'article' : 'post';
      posts.push({
        author: author._id,
        contentType,
        title: contentType === 'article' ? faker.lorem.sentence() : undefined,
        body: contentType === 'article' ? faker.lorem.paragraphs(3) : faker.lorem.sentence(),
        field: faker.helpers.arrayElement(fields)._id,
        tags: [faker.lorem.word(), faker.lorem.word()],
        shares: Math.floor(Math.random() * 100),
        isPublished: true,
        createdAt: faker.date.past({ days: 90 })
      });
    }
    const createdPosts = await Post.insertMany(posts);
    console.log('✅ 2000 posts created');

    // 5. Likes and Bookmarks
    for (const post of createdPosts) {
      post.likes = faker.helpers.arrayElements(createdUsers.map(u => u._id), Math.floor(Math.random() * 40) + 10);
      post.bookmarks = faker.helpers.arrayElements(createdUsers.map(u => u._id), Math.floor(Math.random() * 15) + 5);
      await post.save();
    }
    console.log('✅ Likes and bookmarks assigned');

    // 6. Comments
    const comments = [];
    for (let i = 0; i < 3000; i++) {
      comments.push({
        post: faker.helpers.arrayElement(createdPosts)._id,
        author: faker.helpers.arrayElement(createdUsers)._id,
        body: faker.lorem.sentences(2),
        type: Math.random() > 0.7 ? 'debate' : 'comment',
        createdAt: faker.date.past({ days: 90 })
      });
    }
    await Comment.insertMany(comments);
    console.log('✅ 3000 comments created');

    // 7. Activity
    const actions = ['post', 'like', 'comment', 'share', 'search', 'session', 'follow', 'bookmark', 'debate'];
    for (let i = 0; i < 30; i++) {
      const date = faker.date.recent({ days: 30 });
      const activityBatch = [];
      const count = i === 29 ? 500 : Math.floor(Math.random() * 100) + 50;
      for (let j = 0; j < count; j++) {
        activityBatch.push({
          userId: faker.helpers.arrayElement(createdUsers)._id,
          action: faker.helpers.arrayElement(actions),
          timestamp: date
        });
      }
      await UserActivity.insertMany(activityBatch);
      console.log(`✅ Activity logged for ${date.toDateString()}`);
    }

    // 8. Notifications
    const notifications = [];
    for (let i = 0; i < 500; i++) {
      notifications.push({
        recipient: faker.helpers.arrayElement(createdUsers)._id,
        sender: faker.helpers.arrayElement(createdUsers)._id,
        type: faker.helpers.arrayElement(['like', 'comment', 'follow', 'debate']),
        post: faker.helpers.arrayElement(createdPosts)._id,
        isRead: Math.random() > 0.5,
        createdAt: faker.date.past({ days: 30 })
      });
    }
    await Notification.insertMany(notifications);
    console.log('✅ 500 notifications created');

    console.log(`✅ Seed complete in ${((Date.now() - start) / 1000).toFixed(2)}s`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding:', error);
    process.exit(1);
  }
};

seed();
