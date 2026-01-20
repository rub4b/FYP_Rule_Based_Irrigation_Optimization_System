// Application-wide constants
// These are NOT environment-specific values (use env.js for those)

module.exports = {
  // Crop-Specific Moisture Thresholds (%)
  CROP_MOISTURE_THRESHOLDS: {
    'Rice': { critical: 25, low: 35, optimal_min: 45, optimal_max: 75, high: 85 },
    'Corn': { critical: 20, low: 30, optimal_min: 40, optimal_max: 70, high: 80 },
    'Wheat': { critical: 18, low: 28, optimal_min: 38, optimal_max: 65, high: 75 },
    'Tomato': { critical: 22, low: 32, optimal_min: 42, optimal_max: 72, high: 82 },
    'Lettuce': { critical: 25, low: 35, optimal_min: 45, optimal_max: 75, high: 85 },
    'Carrot': { critical: 20, low: 30, optimal_min: 40, optimal_max: 70, high: 80 },
    'Potato': { critical: 22, low: 32, optimal_min: 42, optimal_max: 70, high: 80 },
    'Onion': { critical: 18, low: 28, optimal_min: 38, optimal_max: 65, high: 75 },
    'Cabbage': { critical: 24, low: 34, optimal_min: 44, optimal_max: 74, high: 84 },
    'Cucumber': { critical: 23, low: 33, optimal_min: 43, optimal_max: 73, high: 83 },
    'Pepper': { critical: 21, low: 31, optimal_min: 41, optimal_max: 71, high: 81 },
    'Beans': { critical: 20, low: 30, optimal_min: 40, optimal_max: 68, high: 78 },
    'Strawberry': { critical: 22, low: 32, optimal_min: 42, optimal_max: 70, high: 80 },
    'default': { critical: 20, low: 30, optimal_min: 40, optimal_max: 70, high: 80 }
  },
  
  // Default Cost Parameters (can be overridden by SystemSettings)
  DEFAULT_COSTS: {
    dieselCostPerLiter: 2.05,      // RM per liter
    electricityCostPerKwh: 0.571,  // RM per kWh
    pumpPowerKw: 3,                // kW
    laborCostPerHour: 15           // RM per hour
  },
  
  // Legacy Moisture Thresholds (for backward compatibility)
  MOISTURE: {
    CRITICAL_LOW: 20,      // Alert when below this %
    CRITICAL_HIGH: 80,     // Alert when above this %
    OPTIMAL_MIN: 40,       // Optimal range minimum
    OPTIMAL_MAX: 70,       // Optimal range maximum
    DEFAULT_MIN: 30        // Default minimum threshold
  },
  
  // User Roles
  ROLES: {
    ADMIN: 'admin',
    FARMER: 'farmer'
  },
  
  // User Status
  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    PENDING: 'pending'
  },
  
  // Plot Status
  PLOT_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ARCHIVED: 'archived'
  },
  
  // Recommendation Status
  RECOMMENDATION_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    COMPLETED: 'completed'
  },
  
  // Audit Log Actions
  AUDIT_ACTIONS: {
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    USER_REGISTER: 'USER_REGISTER',
    USER_UPDATE: 'USER_UPDATE',
    USER_DELETE: 'USER_DELETE',
    USER_STATUS_CHANGE: 'USER_STATUS_CHANGE',
    PLOT_CREATE: 'PLOT_CREATE',
    PLOT_UPDATE: 'PLOT_UPDATE',
    PLOT_DELETE: 'PLOT_DELETE',
    THRESHOLD_UPDATE: 'THRESHOLD_UPDATE',
    SENSOR_DATA_SUBMIT: 'SENSOR_DATA_SUBMIT',
    RECOMMENDATION_CREATE: 'RECOMMENDATION_CREATE',
    RECOMMENDATION_UPDATE: 'RECOMMENDATION_UPDATE',
    SETTINGS_UPDATE: 'SETTINGS_UPDATE',
    SETTINGS_VIEW: 'SETTINGS_VIEW',
    REPORT_GENERATE: 'REPORT_GENERATE',
    NOTIFICATION_SEND: 'NOTIFICATION_SEND',
    SYSTEM_ACCESS: 'SYSTEM_ACCESS'
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    LOGIN_MAX: 10,
    LOGIN_WINDOW_MS: 60 * 60 * 1000 // 1 hour
  },
  
  // Bcrypt Salt Rounds
  BCRYPT_ROUNDS: 10,
  
  // Password Reset Token Expiration
  RESET_TOKEN_EXPIRE: 10 * 60 * 1000, // 10 minutes in milliseconds
  
  // Sensor Data
  SENSOR: {
    MAX_AGE_ONLINE: 5 * 60 * 1000,      // 5 minutes - sensor is online
    MAX_AGE_RECENT: 15 * 60 * 1000,     // 15 minutes - sensor is recent
    MAX_AGE_DELAYED: 60 * 60 * 1000,    // 1 hour - sensor is delayed
    // After this, sensor is offline
  },
  
  // Audit Log Retention
  AUDIT_LOG_TTL_DAYS: 90,
  
  // Weather API
  WEATHER: {
    PROVIDER: 'open-meteo',
    DEFAULT_UPDATE_INTERVAL: 3600, // 1 hour in seconds
    DEFAULT_FORECAST_DAYS: 7
  }
};
