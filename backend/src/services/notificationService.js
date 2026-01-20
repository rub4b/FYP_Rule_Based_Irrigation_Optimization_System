const emailService = require('./emailService');
const User = require('../models/User');
const logger = require('../config/logger');

class NotificationService {
  /**
   * Send notification to a single user
   */
  async sendToUser(userId, subject, message, io = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for notification`);
        return false;
      }

      // Send email
      if (user.email) {
        await emailService.sendEmail(user.email, subject, message);
      }

      // Send WebSocket notification if io is provided
      if (io) {
        io.to(`user_${userId}`).emit('notification', {
          type: 'info',
          subject,
          message,
          timestamp: new Date()
        });
      }

      return true;
    } catch (error) {
      logger.error(`Failed to send notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send system-wide notification to all users
   */
  async broadcastToAll(subject, message, role = null, io = null) {
    try {
      const query = { status: 'active' };
      if (role) {
        query.role = role;
      }

      const users = await User.find(query);
      
      logger.info(`Broadcasting notification to ${users.length} users`);

      const results = await Promise.allSettled(
        users.map(user => this.sendToUser(user._id, subject, message, io))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      
      logger.info(`Notification broadcast completed: ${successful}/${users.length} successful`);

      return { total: users.length, successful };
    } catch (error) {
      logger.error('Failed to broadcast notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to farmers only
   */
  async notifyFarmers(subject, message, io = null) {
    return this.broadcastToAll(subject, message, 'farmer', io);
  }

  /**
   * Send notification to admins only
   */
  async notifyAdmins(subject, message, io = null) {
    return this.broadcastToAll(subject, message, 'admin', io);
  }

  /**
   * Send critical moisture alert
   */
  async sendCriticalMoistureAlert(userId, plotName, moisture, io = null) {
    const subject = '🚨 Critical Moisture Alert - Immediate Action Required';
    const message = `
Hello,

Your plot "${plotName}" has reached a critical moisture level of ${moisture}%.

Immediate irrigation is required to prevent crop damage.

Please check your dashboard for detailed recommendations.

Best regards,
Aquametic Smart Irrigation System
    `;

    return this.sendToUser(userId, subject, message, io);
  }

  /**
   * Send plot status notification
   */
  async sendPlotStatusNotification(userId, plotName, status, details, io = null) {
    const subject = `Plot Status Update: ${plotName}`;
    const message = `
Hello,

Your plot "${plotName}" status has been updated to: ${status}

Details: ${details}

Check your dashboard for more information.

Best regards,
Aquametic Team
    `;

    return this.sendToUser(userId, subject, message, io);
  }
}

module.exports = new NotificationService();
