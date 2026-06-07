import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Field name is required'], unique: true, trim: true },
    slug: { type: String, required: [true, 'Field slug is required'], unique: true, trim: true, lowercase: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Field = mongoose.model('Field', fieldSchema);
export default Field;
