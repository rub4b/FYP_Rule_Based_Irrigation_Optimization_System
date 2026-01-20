const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

// Protect all analytics routes
router.use(auth);

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/trends', analyticsController.getMoistureTrends);
router.get('/cost-savings', analyticsController.getCostSavings);
router.get('/water-conservation', analyticsController.getWaterConservation); // Backward compatibility
router.get('/report/weekly', reportController.generateWeeklyReport); // PDF Report
router.get('/report/csv', reportController.exportDataCSV); // CSV Export

module.exports = router;
