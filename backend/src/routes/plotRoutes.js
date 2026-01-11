const express = require('express');
const router = express.Router();
const plotController = require('../controllers/plotController');
const authMiddleware = require('../middleware/auth');

// All plot routes require authentication
router.use(authMiddleware);

// GET /api/plots - Get all plots for authenticated user
router.get('/', plotController.getAllPlots);

// POST /api/plots - Create a new plot
router.post('/', plotController.createPlot);

// GET /api/plots/:id - Get a single plot
router.get('/:id', plotController.getPlotById);

// PUT /api/plots/:id - Update a plot
router.put('/:id', plotController.updatePlot);

// GET /api/plots/:id/advice - Get irrigation advice for a plot
router.get('/:id/advice', plotController.getPlotAdvice);

// DELETE /api/plots/:id - Delete a plot
router.delete('/:id', plotController.deletePlot);

module.exports = router;
