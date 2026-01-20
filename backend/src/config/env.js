// Centralized environment variable configuration
// All environment variables should be accessed through this module

require('dotenv').config();

module.exports = {
  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
  
  // MongoDB
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/backend_db',
  
  // JWT Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-CHANGE-IN-PRODUCTION',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '24h',
  
  // Admin Configuration
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'AQUAMETIC_ADMIN_2026',
  
  // Frontend Configuration
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://127.0.0.1:5500/frontend',
  
  // Email Service (SMTP)
  EMAIL: {
    HOST: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
    PORT: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
    USER: process.env.EMAIL_USER,
    PASS: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD,
    FROM: process.env.EMAIL_FROM || `Aquametic <${process.env.EMAIL_USER}>`,
    SECURE: process.env.EMAIL_SECURE === 'true' || false
  },
  
  // MQTT Broker
  MQTT: {
    HOST: process.env.MQTT_BROKER_HOST || 'localhost',
    PORT: parseInt(process.env.MQTT_BROKER_PORT || '1883'),
    PROTOCOL: process.env.MQTT_PROTOCOL || 'mqtt',
    USERNAME: process.env.MQTT_USERNAME || '',
    PASSWORD: process.env.MQTT_PASSWORD || '',
    BROKER_URL: process.env.MQTT_BROKER || `mqtt://${process.env.MQTT_BROKER_HOST || 'localhost'}:${process.env.MQTT_BROKER_PORT || 1883}`
  },
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Check if running in production
  isProduction: () => process.env.NODE_ENV === 'production',
  isDevelopment: () => process.env.NODE_ENV !== 'production'
};
