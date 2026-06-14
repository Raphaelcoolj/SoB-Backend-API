import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Field name is required'], unique: true, trim: true },
    slug: { type: String, required: [true, 'Field slug is required'], unique: true, trim: true, lowercase: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // NEW: admin-adjustable boost multiplier for this field
    boostWeight: { 
      type: Number, 
      default: 1.0,
      min: 0.1,
      max: 5.0
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Field = mongoose.model('Field', fieldSchema);
export default Field;
