const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Middleware to automatically log certain actions
 */
const auditLogger = (action, resource) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send function to capture response
    res.send = function(data) {
      // Restore original send
      res.send = originalSend;
      
      // Log audit entry after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const auditData = {
          userId: req.user ? req.user.id : null,
          action,
          resource,
          resourceId: req.params.id || req.body._id || req.body.id,
          details: {
            method: req.method,
            path: req.path,
            body: sanitizeBody(req.body),
            query: req.query
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          status: 'SUCCESS'
        };
        
        AuditLog.create(auditData).catch(err => {
          logger.error('Failed to create audit log:', err);
        });
      }
      
      // Send response
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Manual audit logging function
 */
const logAudit = async (data) => {
  try {
    await AuditLog.create(data);
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};

/**
 * Sanitize sensitive data from body
 */
function sanitizeBody(body) {
  if (!body) return {};
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'resetToken', 'newPassword'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

module.exports = { auditLogger, logAudit };
