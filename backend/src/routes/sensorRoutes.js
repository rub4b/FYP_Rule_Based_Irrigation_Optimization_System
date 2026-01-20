const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { sensorDataValidation, getSensorDataValidation } = require('../middleware/validation');
const { sensorLimiter } = require('../config/rateLimit');

/**
 * @swagger
 * /api/sensor/sync:
 *   post:
 *     summary: Sync sensor data (IoT device endpoint)
 *     tags: [Sensors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plotId
 *               - moisture
 *             properties:
 *               plotId: { type: string, description: MongoDB Plot ID }
 *               moisture: { type: number, minimum: 0, maximum: 100 }
 *               temperature: { type: number, minimum: -50, maximum: 100 }
 *               humidity: { type: number, minimum: 0, maximum: 100 }
 *               deviceId: { type: string }
 *     responses:
 *       201:
 *         description: Sensor data saved successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Too many requests
 */
router.post('/sync', sensorLimiter, sensorDataValidation, sensorController.syncSensorData);

/**
 * @swagger
 * /api/sensor/manual:
 *   post:
 *     summary: Manual sensor data input
 *     tags: [Sensors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plotId
 *               - moisture
 *             properties:
 *               plotId: { type: string }
 *               moisture: { type: number, minimum: 0, maximum: 100 }
 *     responses:
 *       201:
 *         description: Manual sensor data recorded
 *       400:
 *         description: Validation error
 */
router.post('/manual', sensorDataValidation, sensorController.manualSensorInput);

/**
 * @swagger
 * /api/sensor/logs:
 *   get:
 *     summary: Get sensor logs
 *     tags: [Sensors]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 7
 *     responses:
 *       200:
 *         description: Sensor logs retrieved successfully
 */
router.get('/logs', sensorController.getSensorLogs);

module.exports = router;
