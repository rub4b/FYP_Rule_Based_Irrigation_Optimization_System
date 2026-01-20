const { body, param, query, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Auth validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .optional()
    .isIn(['farmer', 'admin']).withMessage('Role must be either farmer or admin'),
  
  validate
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email or username is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  validate
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  validate
];

const resetPasswordValidation = [
  param('resetToken')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 40, max: 64 }).withMessage('Invalid reset token format'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  validate
];

// Plot validation rules
const createPlotValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Plot name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Plot name must be between 2 and 100 characters'),
  
  body('location')
    .trim()
    .notEmpty().withMessage('Location is required')
    .isLength({ min: 2, max: 200 }).withMessage('Location must be between 2 and 200 characters'),
  
  body('size')
    .optional()
    .isFloat({ min: 0 }).withMessage('Size must be a positive number'),
  
  body('cropType')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Crop type must not exceed 50 characters'),
  
  body('soilType')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Soil type must not exceed 50 characters'),
  
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  
  validate
];

const updatePlotValidation = [
  param('id')
    .notEmpty().withMessage('Plot ID is required')
    .isMongoId().withMessage('Invalid plot ID format'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Plot name must be between 2 and 100 characters'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Location must be between 2 and 200 characters'),
  
  body('size')
    .optional()
    .isFloat({ min: 0 }).withMessage('Size must be a positive number'),
  
  body('cropType')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Crop type must not exceed 50 characters'),
  
  body('soilType')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Soil type must not exceed 50 characters'),
  
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  
  validate
];

const plotIdValidation = [
  param('id')
    .notEmpty().withMessage('Plot ID is required')
    .isMongoId().withMessage('Invalid plot ID format'),
  
  validate
];

// Sensor validation rules
const sensorDataValidation = [
  body('sensor_id')
    .notEmpty().withMessage('Sensor ID is required')
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Sensor ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Sensor ID can only contain alphanumeric characters, hyphens, and underscores'),
  
  body('moisture_value')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Moisture must be between 0 and 100'),
  
  body('readings')
    .optional()
    .isArray().withMessage('Readings must be an array')
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(r => typeof r === 'number' && r >= 0 && r <= 100);
      }
      return true;
    }).withMessage('All readings must be numbers between 0 and 100'),
  
  body('temperature')
    .optional()
    .isFloat({ min: -50, max: 100 }).withMessage('Temperature must be between -50 and 100 Celsius'),
  
  body('humidity')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0 and 100'),
  
  validate
];

const getSensorDataValidation = [
  param('plotId')
    .notEmpty().withMessage('Plot ID is required')
    .isMongoId().withMessage('Invalid plot ID format'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  
  validate
];

// Analytics validation rules
const analyticsQueryValidation = [
  query('period')
    .optional()
    .isIn(['7', '30', '90']).withMessage('Period must be 7, 30, or 90 days'),
  
  query('plotId')
    .optional()
    .isMongoId().withMessage('Invalid plot ID format'),
  
  validate
];

const waterConservationValidation = [
  query('period')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('Period must be between 1 and 365 days'),
  
  query('waterCost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Water cost must be a positive number'),
  
  validate
];

module.exports = {
  validate,
  // Auth
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  // Plot
  createPlotValidation,
  updatePlotValidation,
  plotIdValidation,
  // Sensor
  sensorDataValidation,
  getSensorDataValidation,
  // Analytics
  analyticsQueryValidation,
  waterConservationValidation
};
