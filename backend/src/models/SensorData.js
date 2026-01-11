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

module.exports = mongoose.model('SensorData', sensorDataSchema);
