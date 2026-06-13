import mongoose from 'mongoose';
import Field from './src/models/Field.js';

const fieldsToSeed = [
  'Technology',
  'Science',
  'Religion',
  'Astronomy',
  'Business',
  'Travel',
  'Lifestyle',
  'Sports',
  'Music',
  'History'
];

async function seed() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sob');
    console.log('Connected to MongoDB');

    for (const name of fieldsToSeed) {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      await Field.findOneAndUpdate(
        { slug },
        { name, slug, isDefault: true },
        { upsert: true, new: true }
      );
      console.log(`Seeded field: ${name}`);
    }

    console.log('Seeding complete');
  } catch (error) {
    console.error('Error seeding fields:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

seed();
