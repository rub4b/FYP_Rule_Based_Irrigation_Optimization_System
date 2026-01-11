const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

// Protect all analytics routes
router.use(auth);

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/trends', analyticsController.getMoistureTrends);
router.get('/water-conservation', analyticsController.getWaterConservation);

module.exports = router;
