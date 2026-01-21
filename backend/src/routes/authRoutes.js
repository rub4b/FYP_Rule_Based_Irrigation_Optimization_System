const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { 
  registerValidation, 
  loginValidation, 
  forgotPasswordValidation, 
  resetPasswordValidation 
} = require('../middleware/validation');
const { 
  registrationLimiter, 
  loginLimiter, 
  passwordResetLimiter 
} = require('../config/rateLimit');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - name
 *               - email
 *               - password
 *             properties:
 *               username: { type: string, example: farmer1 }
 *               name: { type: string, example: John Doe }
 *               email: { type: string, format: email, example: john@example.com }
 *               password: { type: string, format: password, example: Pass123! }
 *               role: { type: string, enum: [farmer, admin], default: farmer }
 *               phone: { type: string, example: '+8801234567890' }
 *               farm_name: { type: string, example: Green Valley Farm }
 *               location: { type: string, example: Dhaka, Bangladesh }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Too many registration attempts
 */
router.post('/register', registrationLimiter, registerValidation, authController.register);

/**
 * @swagger
 * /api/auth/register/admin:
 *   post:
 *     summary: Register a new admin user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - name
 *               - email
 *               - password
 *               - adminSecret
 *             properties:
 *               username: { type: string, example: admin1 }
 *               name: { type: string, example: Admin User }
 *               email: { type: string, format: email, example: admin@aquametic.com }
 *               password: { type: string, format: password, example: AdminPass123! }
 *               adminSecret: { type: string, example: AQUAMETIC_ADMIN_2026 }
 *               phone: { type: string, example: '+8801234567890' }
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Invalid admin secret
 *       429:
 *         description: Too many registration attempts
 */
router.post('/register/admin', registrationLimiter, registerValidation, authController.registerAdmin);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', loginLimiter, loginValidation, authController.login);

/**
 * @swagger
 * /api/auth/forgotpassword:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset email sent
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many reset requests
 */
router.post('/forgotpassword', passwordResetLimiter, forgotPasswordValidation, authController.forgotPassword);

/**
 * @swagger
 * /api/auth/resetpassword/{resetToken}:
 *   put:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: resetToken
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
 *               - password
 *             properties:
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.put('/resetpassword/:resetToken', resetPasswordValidation, authController.resetPassword);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               farm_name: { type: string }
 *               location: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', authMiddleware, authController.updateProfile);

/**
 * @swagger
 * /api/auth/profile-picture:
 *   put:
 *     summary: Upload profile picture
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 description: Base64 encoded image
 *     responses:
 *       200:
 *         description: Profile picture updated
 *       400:
 *         description: Invalid image data
 *       401:
 *         description: Unauthorized
 */
router.put('/profile-picture', authMiddleware, authController.updateProfilePicture);

/**
 * @swagger
 * /api/auth/profile-picture:
 *   delete:
 *     summary: Remove profile picture
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture removed
 *       401:
 *         description: Unauthorized
 */
router.delete('/profile-picture', authMiddleware, authController.removeProfilePicture);

/**
 * @swagger
 * /api/auth/account:
 *   delete:
 *     summary: Delete own account (requires password confirmation)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password: 
 *                 type: string
 *                 format: password
 *                 description: Current password for confirmation
 *     responses:
 *       200:
 *         description: Account deleted successfully with cascade deletion of all associated data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedResources:
 *                       type: object
 *                       properties:
 *                         plots: { type: number }
 *                         recommendations: { type: number }
 *                         sensorData: { type: number }
 *       400:
 *         description: Password not provided
 *       401:
 *         description: Incorrect password
 *       404:
 *         description: User not found
 */
router.delete('/account', authMiddleware, authController.deleteOwnAccount);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/users', authMiddleware, authController.getAllUsers);

/**
 * @swagger
 * /api/auth/users/{id}/status:
 *   put:
 *     summary: Update user status (Admin only)
 *     tags: [Authentication]
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
 *             properties:
 *               status: { type: string, enum: [active, inactive, suspended] }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.put('/users/:id/status', authMiddleware, authController.updateUserStatus);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   put:
 *     summary: Update user details (Admin only)
 *     tags: [Authentication]
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
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               farm_name: { type: string }
 *               location: { type: string }
 *               role: { type: string, enum: [farmer, admin] }
 *     responses:
 *       200:
 *         description: User updated successfully
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Authentication]
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
 *         description: User deleted successfully
 */
router.put('/users/:id', authMiddleware, authController.updateUser);
router.delete('/users/:id', authMiddleware, authController.deleteUser);

module.exports = router;
