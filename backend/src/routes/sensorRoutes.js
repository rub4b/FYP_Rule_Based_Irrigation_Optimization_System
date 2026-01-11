const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// POST /api/sensor/sync
router.post('/sync', sensorController.syncSensorData);

// POST /api/sensor/manual
router.post('/manual', sensorController.manualSensorInput);

// GET /api/sensor/logs
router.get('/logs', sensorController.getSensorLogs);

module.exports = router;
