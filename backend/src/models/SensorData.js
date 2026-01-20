const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  sensor_id: {
    type: String,
    required: true
  },
  moisture_value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  sync_metadata: {
    is_offline_sync: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for performance - critical for analytics queries
sensorDataSchema.index({ sensor_id: 1, timestamp: -1 }); // Compound index for sensor + time queries
sensorDataSchema.index({ timestamp: -1 }); // Time-based queries
sensorDataSchema.index({ sensor_id: 1 }); // Sensor-specific queries

// TTL index to automatically delete old data after 1 year (optional)
// sensorDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
