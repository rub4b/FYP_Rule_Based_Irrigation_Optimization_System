const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_LOGIN',
      'USER_LOGOUT',
      'USER_REGISTER',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_STATUS_CHANGE',
      'PLOT_CREATE',
      'PLOT_UPDATE',
      'PLOT_DELETE',
      'SENSOR_DATA_SUBMIT',
      'SENSOR_DATA_MANUAL',
      'RECOMMENDATION_GENERATE',
      'RECOMMENDATION_RESPOND',
      'SETTINGS_UPDATE',
      'THRESHOLD_UPDATE',
      'REPORT_GENERATE',
      'NOTIFICATION_SEND',
      'SYSTEM_CONFIG_CHANGE'
    ]
  },
  resource: {
    type: String,
    required: true // e.g., 'User', 'Plot', 'Sensor', 'System'
  },
  resourceId: {
    type: String // ID of the affected resource
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Flexible object for additional details
    default: {}
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'WARNING'],
    default: 'SUCCESS'
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for efficient querying
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Retention policy: Auto-delete logs older than 90 days (optional)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('AuditLog', auditLogSchema);
