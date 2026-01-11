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
  role: {
    type: String,
    enum: ['admin', 'farmer', 'user'],
    default: 'farmer'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
