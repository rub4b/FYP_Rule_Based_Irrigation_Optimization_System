const SensorData = require('../models/SensorData');
const Plot = require('../models/Plot');
const mongoose = require('mongoose');

// GET /api/analytics/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 1. Get total plots count
    const plotsCount = await Plot.countDocuments({ farmer_id: userId });
    
    // 2. Get plots IDs
    const userPlots = await Plot.find({ farmer_id: userId }).select('sensor_id');
    const sensorIds = userPlots.map(p => p.sensor_id).filter(id => id);

    // 3. Get total readings count for these sensors
    const readingsCount = await SensorData.countDocuments({ 
      sensor_id: { $in: sensorIds } 
    });
    
    // 4. Calculate average moisture across all user's plots (Latest reading only)
    let totalCurrentMoisture = 0;
    let activeSensors = 0;
    
    for (const sensorId of sensorIds) {
      const latest = await SensorData.findOne({ sensor_id: sensorId }).sort({ timestamp: -1 });
      if (latest) {
        totalCurrentMoisture += latest.moisture_value;
        activeSensors++;
      }
    }
    
    const avgMoisture = activeSensors > 0 ? (totalCurrentMoisture / activeSensors).toFixed(1) : 0;

    res.json({
        success: true,
        stats: {
            plots: plotsCount,
            totalReadings: readingsCount,
            averageFarmMoisture: avgMoisture,
            activeSensors: activeSensors
        }
    });

  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/trends
// COMPLEXITY: Uses MongoDB Aggregation Pipeline
exports.getMoistureTrends = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query; // Default to last 7 days

    // Get user's sensor IDs
    const userPlots = await Plot.find({ farmer_id: userId }).select('sensor_id');
    const sensorIds = userPlots.map(p => p.sensor_id).filter(id => id);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Aggregate daily averages
    const trends = await SensorData.aggregate([
      {
        $match: {
          sensor_id: { $in: sensorIds },
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } 
          },
          avgMoisture: { $avg: "$moisture_value" },
          readingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } } // Sort by date ascending
    ]);

    res.json({
      success: true,
      trends
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/water-conservation
// COMPLEXITY: Water Savings Calculation & Environmental Impact Analysis
exports.getWaterConservation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days = 30, waterCostPerLiter = 0.05 } = req.query;

    // Configuration (based on agricultural research standards)
    const TRADITIONAL_FREQUENCY_PER_WEEK = 3;
    const SESSION_DURATION_MINUTES = 30;
    const FLOW_RATE_LITERS_PER_MIN = 15;
    const CO2_PER_LITER = 0.0004; // kg (water treatment carbon footprint)
    const CRITICAL_MOISTURE_THRESHOLD = 20;
    const OPTIMAL_MOISTURE_MIN = 40;
    const OPTIMAL_MOISTURE_MAX = 70;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get user's plots and sensor IDs
    const userPlots = await Plot.find({ farmer_id: userId })
      .select('name sensor_id')
      .lean();
    
    if (userPlots.length === 0) {
      return res.json({
        success: true,
        message: 'No plots found',
        data: {
          period: `last_${days}_days`,
          totalWaterSaved: 0,
          totalCostSaved: 0,
          percentageSaved: 0,
          co2Saved: 0,
          plots: []
        }
      });
    }

    const sensorIds = userPlots.map(p => p.sensor_id).filter(id => id);

    // Calculate traditional water usage
    const weeksInPeriod = parseInt(days) / 7;
    const traditionalWaterPerPlot = 
      TRADITIONAL_FREQUENCY_PER_WEEK * 
      SESSION_DURATION_MINUTES * 
      FLOW_RATE_LITERS_PER_MIN * 
      weeksInPeriod;

    const plotResults = [];
    let totalTraditionalUse = 0;
    let totalSmartUse = 0;

    // Analyze each plot
    for (const plot of userPlots) {
      if (!plot.sensor_id) continue;

      // Get sensor data for this plot
      const sensorData = await SensorData.find({
        sensor_id: plot.sensor_id,
        timestamp: { $gte: startDate }
      }).sort({ timestamp: 1 }).lean();

      if (sensorData.length === 0) {
        plotResults.push({
          plotId: plot._id,
          plotName: plot.name,
          sensorId: plot.sensor_id,
          traditionalUse: Math.round(traditionalWaterPerPlot),
          smartUse: 0,
          waterSaved: Math.round(traditionalWaterPerPlot),
          costSaved: (traditionalWaterPerPlot * parseFloat(waterCostPerLiter)).toFixed(2),
          irrigationEvents: 0,
          efficiencyIndex: 0,
          percentageSaved: 100
        });
        totalTraditionalUse += traditionalWaterPerPlot;
        continue;
      }

      // Count irrigation events (moisture drops below threshold)
      let irrigationEvents = 0;
      let daysInOptimalRange = 0;

      for (let i = 0; i < sensorData.length; i++) {
        const moisture = sensorData[i].moisture_value;
        
        // Count critical events (would trigger irrigation)
        if (moisture < CRITICAL_MOISTURE_THRESHOLD) {
          irrigationEvents++;
        }

        // Count days in optimal range
        if (moisture >= OPTIMAL_MOISTURE_MIN && moisture <= OPTIMAL_MOISTURE_MAX) {
          daysInOptimalRange++;
        }
      }

      // Smart water usage based on actual irrigation needs
      const smartWaterUse = 
        irrigationEvents * 
        SESSION_DURATION_MINUTES * 
        FLOW_RATE_LITERS_PER_MIN;

      const waterSaved = traditionalWaterPerPlot - smartWaterUse;
      const costSaved = waterSaved * parseFloat(waterCostPerLiter);
      const efficiencyIndex = sensorData.length > 0 
        ? Math.round((daysInOptimalRange / sensorData.length) * 100) 
        : 0;
      const percentageSaved = traditionalWaterPerPlot > 0
        ? Math.round((waterSaved / traditionalWaterPerPlot) * 100)
        : 0;

      plotResults.push({
        plotId: plot._id,
        plotName: plot.name,
        sensorId: plot.sensor_id,
        traditionalUse: Math.round(traditionalWaterPerPlot),
        smartUse: Math.round(smartWaterUse),
        waterSaved: Math.round(waterSaved),
        costSaved: costSaved.toFixed(2),
        irrigationEvents: irrigationEvents,
        efficiencyIndex: efficiencyIndex,
        percentageSaved: percentageSaved,
        readingsCount: sensorData.length
      });

      totalTraditionalUse += traditionalWaterPerPlot;
      totalSmartUse += smartWaterUse;
    }

    // Calculate totals
    const totalWaterSaved = totalTraditionalUse - totalSmartUse;
    const totalCostSaved = totalWaterSaved * parseFloat(waterCostPerLiter);
    const co2Saved = totalWaterSaved * CO2_PER_LITER;
    const percentageSaved = totalTraditionalUse > 0
      ? Math.round((totalWaterSaved / totalTraditionalUse) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        period: `last_${days}_days`,
        daysAnalyzed: parseInt(days),
        totalTraditionalUse: Math.round(totalTraditionalUse),
        totalSmartUse: Math.round(totalSmartUse),
        totalWaterSaved: Math.round(totalWaterSaved),
        totalCostSaved: totalCostSaved.toFixed(2),
        percentageSaved: percentageSaved,
        co2Saved: co2Saved.toFixed(3),
        currency: '₱',
        waterCostPerLiter: parseFloat(waterCostPerLiter),
        plots: plotResults.sort((a, b) => b.waterSaved - a.waterSaved), // Sort by savings
        configuration: {
          traditionalFrequency: `${TRADITIONAL_FREQUENCY_PER_WEEK}x per week`,
          sessionDuration: `${SESSION_DURATION_MINUTES} minutes`,
          flowRate: `${FLOW_RATE_LITERS_PER_MIN} L/min`,
          criticalThreshold: `${CRITICAL_MOISTURE_THRESHOLD}%`,
          optimalRange: `${OPTIMAL_MOISTURE_MIN}-${OPTIMAL_MOISTURE_MAX}%`
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
