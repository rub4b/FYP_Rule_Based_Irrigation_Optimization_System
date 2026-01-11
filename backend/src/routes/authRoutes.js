const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/forgotpassword
router.post('/forgotpassword', authController.forgotPassword);

// PUT /api/auth/resetpassword/:resettoken
router.put('/resetpassword/:resettoken', authController.resetPassword);

// GET /api/auth/profile - Get user profile (requires authentication)
router.get('/profile', authMiddleware, authController.getProfile);

// PUT /api/auth/profile - Update user profile (requires authentication)
router.put('/profile', authMiddleware, authController.updateProfile);

// GET /api/auth/users - Get all users (admin only)
router.get('/users', authMiddleware, authController.getAllUsers);

module.exports = router;
