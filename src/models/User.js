import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: String,
      default: null,
      select: false, // Never return password in queries by default
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'apple'],
      required: true,
      default: 'local',
    },
    providerId: {
      type: String,
      default: null, // Google sub / Apple sub
    },
    profilePicture: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    otp: {
      type: String,
      default: null,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index for OAuth lookups
userSchema.index({ authProvider: 1, providerId: 1 });

// Hash password before saving (only for local auth)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Strip sensitive fields when converting to JSON
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
