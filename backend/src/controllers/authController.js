const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in node module
const User = require('../models/User');
const emailService = require('../services/emailService');

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

    // Send Welcome Email
    try {
      await emailService.sendEmail(
        user.email,
        'Welcome to Aquametic Smart Farming!',
        `Hello ${user.name},\n\nWelcome to Aquametic! Your account has been successfully created.\n\nUsername: ${user.username}\n\nYou can now log in to monitor your farm's moisture levels and receive automated irrigation advice.\n\nBest regards,\nThe Aquametic Team`
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

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      const error = new Error('Username/Email and password are required');
      error.statusCode = 400;
      throw error;
    }

    // Find user by username or email
    const user = await User.findOne({ 
      $or: [
        { username: username },
        { email: username }
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
      process.env.JWT_SECRET || 'aquametic_secret_key',
      { expiresIn: '24h' }
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
    // Use FRONTEND_URL from environment or default to common frontend locations
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500/frontend';
    const resetUrl = `${frontendUrl}/reset-password.html?token=${resetToken}`;
    
    console.log('Password reset requested for:', user.email);
    console.log('Reset URL generated:', resetUrl);

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. \n\n Please click on the following link to reset your password: \n\n ${resetUrl}`;

    try {
      await emailService.sendEmail(
        user.email,
        'Password Reset Token',
        message
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
    
    // Optional: Send success email
    await emailService.sendEmail(
      user.email,
      'Password Changed Successfully',
      `Hello ${user.name},\n\nYour password has been successfully reset. You can now login with your new password.`
    );

    res.status(200).json({
      success: true,
      data: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};
