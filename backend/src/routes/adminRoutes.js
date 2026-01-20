const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// All admin routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get all system settings (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all settings
 */
router.get('/settings', adminController.getAllSettings);

/**
 * @swagger
 * /api/admin/settings/{category}:
 *   get:
 *     summary: Get settings by category (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [IRRIGATION, WEATHER, NOTIFICATIONS, SYSTEM]
 *     responses:
 *       200:
 *         description: Settings for the category
 *   put:
 *     summary: Update settings by category (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings: { type: object }
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.get('/settings/:category', adminController.getSettingsByCategory);
router.put('/settings/:category', adminController.updateSettings);

/**
 * @swagger
 * /api/admin/system-performance:
 *   get:
 *     summary: Get system performance metrics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System performance data
 */
router.get('/system-performance', adminController.getSystemPerformance);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Audit logs
 */
router.get('/audit-logs', adminController.getAuditLogs);

/**
 * @swagger
 * /api/admin/notify:
 *   post:
 *     summary: Send system-wide notification (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject: { type: string }
 *               message: { type: string }
 *               targetRole: { type: string, enum: [farmer, admin, all] }
 *     responses:
 *       200:
 *         description: Notification sent
 */
router.post('/notify', adminController.sendNotification);

module.exports = router;
