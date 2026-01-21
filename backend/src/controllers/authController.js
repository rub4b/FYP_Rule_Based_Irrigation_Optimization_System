const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in node module
const User = require('../models/User');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const { logAudit } = require('../middleware/auditLogger');
const { JWT_SECRET, JWT_EXPIRE, ADMIN_SECRET, FRONTEND_URL } = require('../config/env');
const { BCRYPT_ROUNDS, RESET_TOKEN_EXPIRE } = require('../config/constants');

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { username, name, email, password, role } = req.body;

    // Validate required fields
    if (!username || !name || !email || !password) {
      const error = new Error('Please provide all required fields');
      error.statusCode = 400;
      throw error;
    }

    // Check if username/email already exists is handled by mongoose duplicate key error in global handler
    // But explicit checks can give better messages
    
    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      const error = new Error('Username already exists');
      error.statusCode = 400;
      throw error;
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const error = new Error('Email already exists');
      error.statusCode = 400;
      throw error;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      username,
      name,
      email,
      password: hashedPassword,
      role: role || 'farmer'
    });

    await user.save();

    // Send Welcome Email using notificationService
    try {
      await notificationService.sendToUser(
        user._id,
        'Welcome to Aquametic Smart Farming!',
        `Hello ${user.name},\n\nWelcome to Aquametic! Your account has been successfully created.\n\nUsername: ${user.username}\n\nYou can now log in to monitor your farm's moisture levels and receive automated irrigation advice.\n\nBest regards,\nThe Aquametic Team`,
        global.io
      );
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
      // Don't fail registration just because email failed
    }

    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      userId: user._id,
      username: user.username
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/register/admin
exports.registerAdmin = async (req, res, next) => {
  try {
    const { username, name, email, password, adminSecret, phone } = req.body;

    // Validate required fields
    if (!username || !name || !email || !password || !adminSecret) {
      const error = new Error('Please provide all required fields including admin secret');
      error.statusCode = 400;
      throw error;
    }

    // Verify admin secret
    if (adminSecret !== ADMIN_SECRET) {
      const error = new Error('Invalid admin secret. Unauthorized admin registration.');
      error.statusCode = 403;
      throw error;
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      const error = new Error('Username already exists');
      error.statusCode = 400;
      throw error;
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const error = new Error('Email already exists');
      error.statusCode = 400;
      throw error;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin user
    const user = new User({
      username,
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: 'admin'
    });

    await user.save();

    // Send Welcome Email using notificationService
    try {
      await notificationService.sendToUser(
        user._id,
        'Welcome to Aquametic Admin Portal!',
        `Hello ${user.name},\n\nYour admin account has been successfully created for Aquametic Smart Farming System.\n\nUsername: ${user.username}\nRole: Administrator\n\nYou can now log in to manage farmers, monitor all plots, and configure the system.\n\nBest regards,\nThe Aquametic Team`,
        global.io
      );
    } catch (emailErr) {
      console.error('Failed to send admin welcome email:', emailErr);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Admin registered successfully',
      userId: user._id,
      username: user.username,
      role: 'admin'
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error('Username/Email and password are required');
      error.statusCode = 400;
      throw error;
    }

    // Find user by username or email
    const user = await User.findOne({ 
      $or: [
        { username: email },
        { email: email }
      ]
    });
    
    if (!user) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/profile - Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        farm_name: user.farm_name,
        location: user.location,
        farm_size: user.farm_size,
        role: user.role,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile - Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, name, email, password, phone, farm_name, location, farm_size } = req.body;
    const userId = req.user.id;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Update username if provided
    if (username && username !== user.username) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        const error = new Error('Username already taken');
        error.statusCode = 400;
        throw error;
      }
      
      user.username = username;
    }
    
    // Update name if provided
    if (name !== undefined) {
      user.name = name;
    }
    
    // Update email if provided
    if (email && email !== user.email) {
      // Check if email is already taken by another user
      const existingEmail = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (existingEmail) {
        const error = new Error('Email already taken');
        error.statusCode = 400;
        throw error;
      }
      
      user.email = email;
    }
    
    // Update optional fields
    if (phone !== undefined) user.phone = phone;
    if (farm_name !== undefined) user.farm_name = farm_name;
    if (location !== undefined) user.location = location;
    if (farm_size !== undefined) user.farm_size = farm_size;

    // Update password if provided (hash it before saving)
    if (password) {
      if (password.length < 6) {
        const error = new Error('Password must be at least 6 characters long');
        error.statusCode = 400;
        throw error;
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    // Save the updated user
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        farm_name: user.farm_name,
        location: user.location,
        farm_size: user.farm_size,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/users - Get all users (admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Access denied. Admin privileges required.');
      error.statusCode = 403;
      throw error;
    }

    // Fetch all users, excluding password field
    const users = await User.find().select('-password');

    res.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/forgotpassword - Request password reset
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      const error = new Error('Please provide an email');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ email });

    if (!user) {
      const error = new Error('There is no user with that email');
      error.statusCode = 404;
      throw error;
    }

    // Get reset token (random 20 hex characters)
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    // In a real app, you would hash this before saving to DB for security
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire (30 minutes for better user experience)
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

    await user.save();

    // Create reset URL
    const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    
    console.log('Password reset requested for:', user.email);
    console.log('Reset URL generated:', resetUrl);

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. \n\n Please click on the following link to reset your password: \n\n ${resetUrl}`;

    try {
      await notificationService.sendToUser(
        user._id,
        'Password Reset Token',
        message,
        global.io
      );

      res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
      console.error(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      const error = new Error('Email could not be sent');
      error.statusCode = 500;
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/resetpassword/:resettoken - Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    console.log('Reset password request received');
    console.log('Token from URL:', req.params.resettoken);
    
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');
    
    console.log('Hashed token:', resetPasswordToken);

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() } // Check if not expired
    });

    if (!user) {
      console.log('No user found with this token or token expired');
      const error = new Error('Invalid or expired reset token');
      error.statusCode = 400;
      throw error;
    }
    
    console.log('User found:', user.email);

    // Set new password
    if (!req.body.password) {
      const error = new Error('Please provide a new password');
      error.statusCode = 400;
      throw error;
    }

    // Encrypt new password
    user.password = await bcrypt.hash(req.body.password, 10);
    
    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    
    // Optional: Send success email using notificationService
    await notificationService.sendToUser(
      user._id,
      'Password Changed Successfully',
      `Hello ${user.name},\n\nYour password has been successfully reset. You can now login with your new password.`,
      global.io
    );

    res.status(200).json({
      success: true,
      data: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/users/:id/status - Admin: Update user status
exports.updateUserStatus = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const { status, reason } = req.body;
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      const error = new Error('Invalid status. Must be active, inactive, or suspended');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id) {
      const error = new Error('Cannot modify your own account status');
      error.statusCode = 400;
      throw error;
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save();

    // Log audit
    await logAudit({
      userId: req.user.id,
      action: 'USER_STATUS_CHANGE',
      resource: 'User',
      resourceId: user._id.toString(),
      details: {
        oldStatus,
        newStatus: status,
        reason: reason || 'No reason provided',
        targetUser: user.username
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    // Send email notification using notificationService
    try {
      let emailMessage = `Your account status has been changed to ${status}.`;
      if (reason) {
        emailMessage += `\n\nReason: ${reason}`;
      }
      
      await notificationService.sendToUser(
        user._id,
        `Account Status Updated`,
        `Hello ${user.name},\n\n${emailMessage}\n\nIf you have any questions, please contact support.\n\nBest regards,\nThe Aquametic Team`,
        global.io
      );
    } catch (emailErr) {
      console.error('Failed to send status update email:', emailErr);
    }

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: {
        userId: user._id,
        username: user.username,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/auth/users/:id - Admin: Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      const error = new Error('Cannot delete your own account');
      error.statusCode = 400;
      throw error;
    }

    const deletedUsername = user.username;
    const deletedEmail = user.email;
    
    await User.findByIdAndDelete(req.params.id);

    // Log audit
    await logAudit({
      userId: req.user.id,
      action: 'USER_DELETE',
      resource: 'User',
      resourceId: req.params.id,
      details: {
        deletedUsername,
        deletedEmail,
        deletedRole: user.role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/auth/account - Delete own account
exports.deleteOwnAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Password confirmation required for security
    const { password } = req.body;
    if (!password) {
      const error = new Error('Password confirmation required to delete account');
      error.statusCode = 400;
      throw error;
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      const error = new Error('Incorrect password');
      error.statusCode = 401;
      throw error;
    }

    const deletedUsername = user.username;
    const deletedEmail = user.email;
    
    // Import models for cascade deletion
    const Plot = require('../models/Plot');
    const Recommendation = require('../models/Recommendation');
    const SensorData = require('../models/SensorData');
    const AuditLog = require('../models/AuditLog');
    
    // Get user's plots to find associated sensor IDs
    const userPlots = await Plot.find({ farmer_id: userId });
    const sensorIds = [];
    
    userPlots.forEach(plot => {
      if (plot.sensor_id) sensorIds.push(plot.sensor_id);
      if (plot.sensor_ids && plot.sensor_ids.length > 0) {
        sensorIds.push(...plot.sensor_ids);
      }
    });
    
    // Cascade delete: Remove all associated data to maintain integrity
    // 1. Delete all recommendations for this user
    const deletedRecommendations = await Recommendation.deleteMany({ farmer_id: userId });
    
    // 2. Delete all plots owned by this user
    const deletedPlots = await Plot.deleteMany({ farmer_id: userId });
    
    // 3. Delete sensor data for sensors that belonged to user's plots
    let deletedSensorData = { deletedCount: 0 };
    if (sensorIds.length > 0) {
      deletedSensorData = await SensorData.deleteMany({ 
        sensor_id: { $in: sensorIds } 
      });
    }
    
    // 4. Keep audit logs for compliance but anonymize user reference
    // (Optional: You can delete audit logs too, but keeping them is better for security compliance)
    await AuditLog.updateMany(
      { userId: userId },
      { $set: { userId: null, details: { ...{}, anonymized: true, reason: 'User account deleted' } } }
    );
    
    // 5. Finally delete the user account
    await User.findByIdAndDelete(userId);

    // Log final audit before deletion
    await logAudit({
      userId: userId,
      action: 'ACCOUNT_SELF_DELETE',
      resource: 'User',
      resourceId: userId,
      details: {
        deletedUsername,
        deletedEmail,
        deletedRole: user.role,
        cascadeDeleted: {
          plots: deletedPlots.deletedCount,
          recommendations: deletedRecommendations.deletedCount,
          sensorData: deletedSensorData.deletedCount
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully. All associated data has been removed.',
      data: {
        deletedResources: {
          plots: deletedPlots.deletedCount,
          recommendations: deletedRecommendations.deletedCount,
          sensorData: deletedSensorData.deletedCount
        }
      }
    });
  } catch (error) {
    // Log failed deletion attempt
    await logAudit({
      userId: req.user?.id || null,
      action: 'ACCOUNT_SELF_DELETE',
      resource: 'User',
      resourceId: req.user?.id || null,
      details: {
        error: error.message
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'FAILURE'
    });
    
    next(error);
  }
};

// PUT /api/auth/users/:id - Admin: Update user details
exports.updateUser = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to access this route');
      error.statusCode = 403;
      throw error;
    }

    const { name, email, phone, farm_name, location, role } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Check email uniqueness if being changed
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        const error = new Error('Email already in use');
        error.statusCode = 400;
        throw error;
      }
      user.email = email;
    }

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (farm_name) user.farm_name = farm_name;
    if (location) user.location = location;
    if (role && ['farmer', 'admin'].includes(role)) {
      user.role = role;
    }

    await user.save();

    // Log audit
    await logAudit({
      userId: req.user.id,
      action: 'USER_UPDATE',
      resource: 'User',
      resourceId: user._id.toString(),
      details: {
        updatedFields: { name, email, phone, farm_name, location, role },
        targetUser: user.username
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        farm_name: user.farm_name,
        location: user.location
      }
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile-picture - Upload/Update profile picture
exports.updateProfilePicture = async (req, res, next) => {
  try {
    const { profilePicture } = req.body;
    
    if (!profilePicture) {
      const error = new Error('No profile picture provided');
      error.statusCode = 400;
      throw error;
    }
    
    // Validate base64 image format
    if (!profilePicture.startsWith('data:image/')) {
      const error = new Error('Invalid image format');
      error.statusCode = 400;
      throw error;
    }
    
    // Find and update user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    
    user.profilePicture = profilePicture;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/auth/profile-picture - Remove profile picture
exports.removeProfilePicture = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    
    user.profilePicture = null;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully'
    });
  } catch (error) {
    next(error);
  }
};
