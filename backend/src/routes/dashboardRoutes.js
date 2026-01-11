const express = require('express');
const router = express.Router();
const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const authMiddleware = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

// GET /api/dashboard/farmer-stats - Get farmer statistics (Protected)
router.get('/farmer-stats', authMiddleware, async (req, res) => {
  try {
    // Get userId from authenticated user (from JWT token)
    const userId = req.user.id;
    
    // If user is farmer, they can only see their own plots
    // If user is admin, they can specify userId in query or see all
    const targetUserId = req.user.role === 'admin' && req.query.userId 
      ? req.query.userId 
      : userId;

    // Get farmer's plots
    const plotsRaw = await Plot.find({ farmer_id: targetUserId });
    
    // Enrich plots with current moisture and timestamp
    const plots = await Promise.all(plotsRaw.map(async (plot) => {
      const latestSensorData = await SensorData.findOne({ sensor_id: plot.sensor_id })
        .sort({ timestamp: -1 })
        .limit(1);
      
      return {
        _id: plot._id,
        name: plot.name,
        farmer_id: plot.farmer_id,
        sensor_id: plot.sensor_id,
        location: plot.location,
        crop_type: plot.crop_type,
        current_moisture: latestSensorData ? latestSensorData.moisture_value : 0,
        timestamp: latestSensorData ? latestSensorData.timestamp : null,
        last_updated: latestSensorData ? latestSensorData.timestamp : null,
        time: latestSensorData ? latestSensorData.timestamp : null
      };
    }));
    
    // Get recent sensor data for all plots
    const plotStats = await Promise.all(plots.map(async (plot) => {
      const recentData = await SensorData.find({ sensor_id: plot.sensor_id })
        .sort({ timestamp: -1 })
        .limit(20);
      
      return {
        plot,
        recentData
      };
    }));

    res.json({ 
      success: true, 
      plots,
      plotStats,
      totalPlots: plots.length
    });
  } catch (error) {
    console.error('Error fetching farmer stats:', error);
    res.status(500).json({ error: 'Failed to fetch farmer stats' });
  }
});

// GET /api/dashboard/admin-stats - Get admin statistics (Admin Only)
router.get('/admin-stats', authMiddleware, isAdmin, async (req, res) => {
  try {
    // Get all plots with farmer information
    const plots = await Plot.find().populate('farmer_id', 'username role');
    
    // Get recent sensor data for each plot
    const plotStats = await Promise.all(plots.map(async (plot) => {
      const recentData = await SensorData.find({ sensor_id: plot.sensor_id })
        .sort({ timestamp: -1 })
        .limit(10);
      
      const latestReading = recentData[0];
      
      return {
        plot,
        latestReading,
        recentData
      };
    }));

    res.json({ 
      success: true, 
      plots,
      plotStats,
      totalPlots: plots.length,
      totalFarmers: await require('../models/User').countDocuments({ role: 'farmer' }),
      totalSensors: plots.length
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/dashboard/plots - Get all plots (for Admins) or user's plots (for Farmers) - Protected
router.get('/plots', authMiddleware, async (req, res) => {
  try {
    // Get role from JWT token (not query params - more secure!)
    const { role, id: userId } = req.user;

    let plots;
    if (role === 'admin') {
      // Admins see all plots
      plots = await Plot.find().populate('farmer_id', 'username');
    } else {
      // Farmers see only their plots
      plots = await Plot.find({ farmer_id: userId }).populate('farmer_id', 'username');
    }

    res.json({ success: true, plots });
  } catch (error) {
    console.error('Error fetching plots:', error);
    res.status(500).json({ error: 'Failed to fetch plots' });
  }
});

// GET /api/dashboard/plot/:id - Get single plot details (Protected)
router.get('/plot/:id', authMiddleware, async (req, res) => {
  try {
    const plot = await Plot.findById(req.params.id).populate('farmer_id', 'username');
    
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }

    // Authorization: Farmers can only see their own plots, admins can see all
    if (req.user.role !== 'admin' && plot.farmer_id._id.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only view your own plots.' 
      });
    }

    res.json({ success: true, plot });
  } catch (error) {
    console.error('Error fetching plot:', error);
    res.status(500).json({ error: 'Failed to fetch plot' });
  }
});

// GET /api/dashboard/sensor-data/:sensorId - Get sensor data for a specific sensor (Protected)
router.get('/sensor-data/:sensorId', authMiddleware, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const sensorData = await SensorData.find({ sensor_id: req.params.sensorId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: sensorData });
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

module.exports = router;
