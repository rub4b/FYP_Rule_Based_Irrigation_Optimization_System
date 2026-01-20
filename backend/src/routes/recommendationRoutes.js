const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * /api/recommendations/generate/{plotId}:
 *   post:
 *     summary: Generate irrigation recommendation for a plot
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: plotId
 *         required: true
 *         schema:
 *           type: string
 *         description: Plot ID
 *     responses:
 *       201:
 *         description: Recommendation generated successfully
 *       404:
 *         description: Plot or sensor data not found
 */
router.post('/generate/:plotId', authMiddleware, recommendationController.generateRecommendation);

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     summary: Get all recommendations for authenticated user
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, overridden]
 *       - in: query
 *         name: plotId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of recommendations
 */
router.get('/', authMiddleware, recommendationController.getRecommendations);

/**
 * @swagger
 * /api/recommendations/{id}/respond:
 *   put:
 *     summary: Accept, reject, or override a recommendation
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accepted, rejected, override_irrigate, override_skip]
 *               notes:
 *                 type: string
 *               actualWaterMl:
 *                 type: number
 *     responses:
 *       200:
 *         description: Response recorded successfully
 */
router.put('/:id/respond', authMiddleware, recommendationController.respondToRecommendation);

/**
 * @swagger
 * /api/recommendations/stats:
 *   get:
 *     summary: Get recommendation statistics
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Recommendation statistics
 */
router.get('/stats', authMiddleware, recommendationController.getRecommendationStats);

/**
 * @swagger
 * /api/recommendations/{id}:
 *   delete:
 *     summary: Delete a recommendation
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recommendation deleted successfully
 */
router.delete('/:id', authMiddleware, recommendationController.deleteRecommendation);

/**
 * @swagger
 * /api/recommendations/schedule:
 *   get:
 *     summary: Get irrigation schedule
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: plotId
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *     responses:
 *       200:
 *         description: Irrigation schedule
 */
router.get('/schedule', authMiddleware, recommendationController.getIrrigationSchedule);

module.exports = router;
