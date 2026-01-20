const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/settings/cost-parameters - Get cost parameters
router.get('/cost-parameters', settingsController.getCostParameters);

// GET /api/settings/moisture-thresholds/:cropType - Get moisture thresholds for crop
router.get('/moisture-thresholds/:cropType', settingsController.getMoistureThresholds);

// GET /api/settings/all-moisture-thresholds - Get all crop thresholds
router.get('/all-moisture-thresholds', settingsController.getAllMoistureThresholds);

// PUT /api/settings/cost-parameters - Update cost parameters (admin only)
router.put('/cost-parameters', settingsController.updateCostParameters);

module.exports = router;
