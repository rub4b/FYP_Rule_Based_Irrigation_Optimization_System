const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const Recommendation = require('../models/Recommendation');
const AuditLog = require('../models/AuditLog');
const { logAudit } = require('../middleware/auditLogger');
const notificationService = require('../services/notificationService');
const { PAGINATION } = require('../config/constants');

// GET /api/admin/settings - Get all system settings
exports.getAllSettings = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const settings = await SystemSettings.find();
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/settings/:category - Get settings by category
exports.getSettingsByCategory = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const { category } = req.params;
    const settings = await SystemSettings.findOne({ category: category.toUpperCase() });
    
    if (!settings) {
      const error = new Error('Settings category not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/settings/:category - Update settings
exports.updateSettings = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const { category } = req.params;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      const error = new Error('Invalid settings format');
      error.statusCode = 400;
      throw error;
    }

    const existingSettings = await SystemSettings.findOne({ category: category.toUpperCase() });
    
    if (!existingSettings) {
      const error = new Error('Settings category not found');
      error.statusCode = 404;
      throw error;
    }

    const oldSettings = { ...existingSettings.settings };
    
    // Update settings
    existingSettings.settings = {
      ...existingSettings.settings,
      ...settings
    };
    existingSettings.updatedBy = req.user.id;
    await existingSettings.save();

    // Log audit
    await logAudit({
      userId: req.user.id,
      action: 'SETTINGS_UPDATE',
      resource: 'SystemSettings',
      resourceId: existingSettings._id.toString(),
      details: {
        category,
        oldSettings,
        newSettings: existingSettings.settings
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: existingSettings
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/system-performance - Get system performance metrics
exports.getSystemPerformance = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const User = require('../models/User');
    const Plot = require('../models/Plot');
    const SensorData = require('../models/SensorData');
    const Recommendation = require('../models/Recommendation');

    // Calculate uptime (server start time)
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // Database statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const totalPlots = await Plot.countDocuments();
    const activePlots = await Plot.countDocuments({ status: 'active' });
    
    // Sensor data in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSensorData = await SensorData.countDocuments({ 
      createdAt: { $gte: yesterday } 
    });

    // Recommendations in last 24 hours
    const recentRecommendations = await Recommendation.countDocuments({ 
      createdAt: { $gte: yesterday } 
    });

    // API response times (from last hour logs - simplified)
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const AuditLog = require('../models/AuditLog');
    const recentActions = await AuditLog.countDocuments({ 
      createdAt: { $gte: lastHour } 
    });

    res.status(200).json({
      success: true,
      data: {
        uptime: {
          seconds: Math.floor(uptime),
          formatted: `${uptimeHours}h ${uptimeMinutes}m`
        },
        memory: memoryUsageMB,
        database: {
          users: { total: totalUsers, active: activeUsers },
          plots: { total: totalPlots, active: activePlots },
          recentSensorData,
          recentRecommendations
        },
        activity: {
          actionsLastHour: recentActions,
          sensorDataLast24h: recentSensorData,
          recommendationsLast24h: recentRecommendations
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/audit-logs - Get audit logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const AuditLog = require('../models/AuditLog');
    
    const { action, resource, userId, limit = 50, page = 1, startDate, endDate } = req.query;
    
    const query = {};
    
    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (userId) query.userId = userId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await AuditLog.find(query)
      .populate('userId', 'username name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/notify - Send system-wide notification
exports.sendNotification = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const { subject, message, targetRole } = req.body;

    if (!subject || !message) {
      const error = new Error('Subject and message are required');
      error.statusCode = 400;
      throw error;
    }

    const notificationService = require('../services/notificationService');
    const io = req.app.get('io');

    let result;
    if (targetRole === 'farmer') {
      result = await notificationService.notifyFarmers(subject, message, io);
    } else if (targetRole === 'admin') {
      result = await notificationService.notifyAdmins(subject, message, io);
    } else {
      result = await notificationService.broadcastToAll(subject, message, null, io);
    }

    // Log audit
    await logAudit({
      userId: req.user.id,
      action: 'NOTIFICATION_SEND',
      resource: 'System',
      details: {
        subject,
        targetRole: targetRole || 'all',
        recipientCount: result.total
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
