const mongoose = require('mongoose');

const plotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  farmer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sensor_id: {
    type: String,
    required: false // Primary sensor (for backward compatibility)
  },
  sensor_ids: {
    type: [String],
    default: []
  },
  crop_type: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    required: true
  },
  size_acres: {
    type: Number,
    default: 2.5, // Default to 2.5 acres (~1 hectare)
    min: 0.01,
    max: 2500 // Up to ~1000 hectares
  },
  number_of_sensors: {
    type: Number,
    default: 1,
    min: 1,
    max: 50 // Maximum 50 sensors per plot
  },
  current_moisture: {
    type: Number,
    default: 0
  },
  thresholds: {
    moistureMin: {
      type: Number,
      default: 30, // Alert when moisture drops below 30%
      min: 0,
      max: 100
    },
    moistureCritical: {
      type: Number,
      default: 20, // Critical alert below 20%
      min: 0,
      max: 100
    },
    moistureOptimalMin: {
      type: Number,
      default: 40,
      min: 0,
      max: 100
    },
    moistureOptimalMax: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for performance
plotSchema.index({ farmer_id: 1 });
plotSchema.index({ sensor_id: 1 });
plotSchema.index({ sensor_ids: 1 });
plotSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Plot', plotSchema);
