const SystemSettings = require('../models/SystemSettings');
const { CROP_MOISTURE_THRESHOLDS, DEFAULT_COSTS } = require('../config/constants');

/**
 * GET /api/settings/cost-parameters
 * Get cost parameters for analytics calculations
 * Accessible by: farmer, admin
 */
exports.getCostParameters = async (req, res, next) => {
  try {
    // Try to get from database first
    const settings = await SystemSettings.findOne({ category: 'COSTS' });
    
    if (settings && settings.settings) {
      return res.status(200).json({
        success: true,
        data: {
          dieselCostPerLiter: settings.settings.dieselCostPerLiter || DEFAULT_COSTS.dieselCostPerLiter,
          electricityCostPerKwh: settings.settings.electricityCostPerKwh || DEFAULT_COSTS.electricityCostPerKwh,
          pumpPowerKw: settings.settings.pumpPowerKw || DEFAULT_COSTS.pumpPowerKw,
          laborCostPerHour: settings.settings.laborCostPerHour || DEFAULT_COSTS.laborCostPerHour,
          source: 'database'
        }
      });
    }
    
    // Fallback to defaults
    res.status(200).json({
      success: true,
      data: {
        ...DEFAULT_COSTS,
        source: 'defaults'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settings/moisture-thresholds/:cropType
 * Get moisture thresholds for a specific crop type
 * Accessible by: farmer, admin
 */
exports.getMoistureThresholds = async (req, res, next) => {
  try {
    const { cropType } = req.params;
    
    // Get crop-specific thresholds or default
    const thresholds = CROP_MOISTURE_THRESHOLDS[cropType] || CROP_MOISTURE_THRESHOLDS['default'];
    
    res.status(200).json({
      success: true,
      data: {
        cropType: cropType,
        thresholds: thresholds,
        available_crops: Object.keys(CROP_MOISTURE_THRESHOLDS).filter(c => c !== 'default')
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settings/all-moisture-thresholds
 * Get moisture thresholds for all crop types
 * Accessible by: farmer, admin
 */
exports.getAllMoistureThresholds = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: CROP_MOISTURE_THRESHOLDS
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/settings/cost-parameters
 * Update cost parameters (admin only)
 * Accessible by: admin only
 */
exports.updateCostParameters = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      const error = new Error('Not authorized to update cost parameters');
      error.statusCode = 403;
      throw error;
    }

    const { dieselCostPerLiter, electricityCostPerKwh, pumpPowerKw, laborCostPerHour } = req.body;

    // Validate inputs
    if (dieselCostPerLiter !== undefined && (isNaN(dieselCostPerLiter) || dieselCostPerLiter < 0)) {
      const error = new Error('Invalid diesel cost value');
      error.statusCode = 400;
      throw error;
    }
    if (electricityCostPerKwh !== undefined && (isNaN(electricityCostPerKwh) || electricityCostPerKwh < 0)) {
      const error = new Error('Invalid electricity cost value');
      error.statusCode = 400;
      throw error;
    }
    if (pumpPowerKw !== undefined && (isNaN(pumpPowerKw) || pumpPowerKw <= 0)) {
      const error = new Error('Invalid pump power value');
      error.statusCode = 400;
      throw error;
    }
    if (laborCostPerHour !== undefined && (isNaN(laborCostPerHour) || laborCostPerHour < 0)) {
      const error = new Error('Invalid labor cost value');
      error.statusCode = 400;
      throw error;
    }

    // Find or create COSTS settings
    let settings = await SystemSettings.findOne({ category: 'COSTS' });
    
    if (!settings) {
      settings = new SystemSettings({
        category: 'COSTS',
        settings: DEFAULT_COSTS,
        updated_by: req.user.userId
      });
    }

    // Update only provided values
    if (dieselCostPerLiter !== undefined) settings.settings.dieselCostPerLiter = parseFloat(dieselCostPerLiter);
    if (electricityCostPerKwh !== undefined) settings.settings.electricityCostPerKwh = parseFloat(electricityCostPerKwh);
    if (pumpPowerKw !== undefined) settings.settings.pumpPowerKw = parseFloat(pumpPowerKw);
    if (laborCostPerHour !== undefined) settings.settings.laborCostPerHour = parseFloat(laborCostPerHour);
    
    settings.updated_by = req.user.userId;
    settings.updated_at = Date.now();

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Cost parameters updated successfully',
      data: settings.settings
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCostParameters: exports.getCostParameters,
  getMoistureThresholds: exports.getMoistureThresholds,
  getAllMoistureThresholds: exports.getAllMoistureThresholds,
  updateCostParameters: exports.updateCostParameters
};
