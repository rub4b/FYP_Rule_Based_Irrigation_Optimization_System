const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true
  },
  farm_name: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  farm_size: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['farmer', 'admin'],
    default: 'farmer'
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true
});

// Indexes for performance (email and username already indexed via unique: true)
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
