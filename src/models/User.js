import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    username: { type: String, required: [true, 'Username is required'], unique: true, trim: true, lowercase: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    },
    password: {
      type: String,
      required: function () { return !this.googleId; },
    },
    googleId: { type: String, default: null },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    priorityFields: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }], default: [] },
    emailNotifications: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }], default: [] },
    followers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    following: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    isOnboarded: { type: Boolean, default: true },
    pushSubscription: {
      endpoint: { type: String, default: null },
      keys: {
        p256dh: { type: String, default: null },
        auth: { type: String, default: null },
      },
    },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password on save
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.compareRefreshToken = async function (candidateToken) {
  if (!this.refreshToken) return false;
  return bcrypt.compare(candidateToken, this.refreshToken);
};

const User = mongoose.model('User', userSchema);
export default User;
