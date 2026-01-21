const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    unique: true,
    enum: ['IRRIGATION', 'WEATHER', 'NOTIFICATIONS', 'SYSTEM', 'COSTS']
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Default settings initialization
systemSettingsSchema.statics.initializeDefaults = async function() {
  const defaults = [
    {
      category: 'IRRIGATION',
      settings: {
        defaultMoistureThreshold: 30,
        criticalMoistureLevel: 20,
        optimalMoistureRange: { min: 40, max: 70 },
        wateringDurationPercentage: 0.6, // 60% of calculated need
        schedulingBuffer: 24 // hours
      }
    },
    {
      category: 'WEATHER',
      settings: {
        apiProvider: 'open-meteo',
        apiUrl: 'https://api.open-meteo.com/v1/forecast',
        updateInterval: 3600, // seconds (1 hour)
        forecastDays: 7,
        enableRainPrediction: true
      }
    },
    {
      category: 'NOTIFICATIONS',
      settings: {
        enableEmail: true,
        enableWebSocket: true,
        criticalAlertThreshold: 15, // moisture %
        emailProvider: 'gmail',
        smtpSettings: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: false
        }
      }
    },
    {
      category: 'SYSTEM',
      settings: {
        maintenanceMode: false,
        maxPlotsPerFarmer: 50,
        dataRetentionDays: 365,
        sessionTimeout: 3600, // seconds
        mqttBroker: process.env.MQTT_BROKER || 'mqtt://localhost:1883'
      }
    }
  ];

  for (const setting of defaults) {
    await this.findOneAndUpdate(
      { category: setting.category },
      setting,
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
