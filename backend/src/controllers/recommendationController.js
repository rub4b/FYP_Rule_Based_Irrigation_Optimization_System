const Recommendation = require('../models/Recommendation');
const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const axios = require('axios');

// POST /api/recommendations/generate/:plotId
// Generate irrigation recommendation for a plot
exports.generateRecommendation = async (req, res, next) => {
  try {
    const { plotId } = req.params;
    const userId = req.user.id;

    // Verify plot ownership
    const plot = await Plot.findOne({ _id: plotId, farmer_id: userId });
    if (!plot) {
      const error = new Error('Plot not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    // Get latest sensor data
    const latestData = await SensorData.findOne({ sensor_id: plot.sensor_id })
      .sort({ timestamp: -1 })
      .limit(1);

    if (!latestData) {
      const error = new Error('No sensor data available for this plot');
      error.statusCode = 404;
      throw error;
    }

    const moistureLevel = latestData.moisture_value;

    // Get weather data
    let weatherCondition = {};
    if (plot.location) {
      try {
        const coords = plot.location.split(',').map(c => parseFloat(c.trim()));
        if (coords.length === 2) {
          const [lat, lng] = coords;
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m&daily=precipitation_probability_max&timezone=auto`;
          const weatherResponse = await axios.get(weatherUrl, { timeout: 3000 });
          
          weatherCondition = {
            temperature: weatherResponse.data.current?.temperature_2m || null,
            humidity: weatherResponse.data.current?.relative_humidity_2m || null,
            precipitation_probability: weatherResponse.data.daily?.precipitation_probability_max?.[0] || null
          };
        }
      } catch (err) {
        console.warn('Weather fetch failed:', err.message);
      }
    }

    // Generate recommendation logic
    let recommendationType, recommendationText, reason, estimatedWater = 0;

    if (moistureLevel < 20) {
      recommendationType = 'irrigate';
      recommendationText = 'Immediate irrigation recommended';
      reason = `Soil moisture critically low (${moistureLevel}%). Plants are at risk.`;
      estimatedWater = 15000; // 15 liters
    } else if (moistureLevel >= 20 && moistureLevel < 40) {
      if (weatherCondition.precipitation_probability && weatherCondition.precipitation_probability > 60) {
        recommendationType = 'skip';
        recommendationText = 'Skip irrigation - rain expected';
        reason = `Moisture is ${moistureLevel}%, and ${weatherCondition.precipitation_probability}% chance of rain today.`;
        estimatedWater = 0;
      } else {
        recommendationType = 'irrigate';
        recommendationText = 'Irrigation recommended';
        reason = `Soil moisture low (${moistureLevel}%). Irrigation will optimize plant growth.`;
        estimatedWater = 10000; // 10 liters
      }
    } else if (moistureLevel >= 40 && moistureLevel < 70) {
      recommendationType = 'maintain';
      recommendationText = 'Maintain current schedule';
      reason = `Soil moisture optimal (${moistureLevel}%). Continue monitoring.`;
      estimatedWater = 0;
    } else {
      recommendationType = 'skip';
      recommendationText = 'No irrigation needed';
      reason = `Soil moisture high (${moistureLevel}%). Over-irrigation risk.`;
      estimatedWater = 0;
    }

    // Create recommendation
    const recommendation = new Recommendation({
      plot_id: plotId,
      farmer_id: userId,
      recommendation_type: recommendationType,
      recommendation_text: recommendationText,
      reason: reason,
      moisture_level: moistureLevel,
      weather_condition: weatherCondition,
      estimated_water_ml: estimatedWater,
      status: 'pending'
    });

    await recommendation.save();

    res.status(201).json({
      success: true,
      recommendation: recommendation
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recommendations
// Get all recommendations for the authenticated user
exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, plotId, limit = 50, skip = 0 } = req.query;

    const query = { farmer_id: userId };
    if (status) query.status = status;
    if (plotId) query.plot_id = plotId;

    const recommendations = await Recommendation.find(query)
      .populate('plot_id', 'name location')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Recommendation.countDocuments(query);

    res.json({
      success: true,
      count: recommendations.length,
      total: total,
      recommendations: recommendations
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/recommendations/:id/respond
// Accept, reject, or override a recommendation
exports.respondToRecommendation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { action, notes, actualWaterMl } = req.body;

    // Validate action
    const validActions = ['accepted', 'rejected', 'override_irrigate', 'override_skip'];
    if (!validActions.includes(action)) {
      const error = new Error('Invalid action. Must be: accepted, rejected, override_irrigate, or override_skip');
      error.statusCode = 400;
      throw error;
    }

    // Find recommendation
    const recommendation = await Recommendation.findOne({ _id: id, farmer_id: userId });
    if (!recommendation) {
      const error = new Error('Recommendation not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    // Update recommendation
    recommendation.farmer_action = action;
    recommendation.farmer_notes = notes || '';
    recommendation.responded_at = new Date();

    // Update status
    if (action === 'accepted') {
      recommendation.status = 'accepted';
    } else if (action === 'rejected') {
      recommendation.status = 'rejected';
    } else {
      recommendation.status = 'overridden';
    }

    // Update actual water usage if provided
    if (actualWaterMl !== undefined && actualWaterMl !== null) {
      recommendation.actual_water_ml = parseFloat(actualWaterMl);
    }

    await recommendation.save();

    res.json({
      success: true,
      message: 'Recommendation response recorded',
      recommendation: recommendation
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recommendations/stats
// Get recommendation statistics for the user
exports.getRecommendationStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const recommendations = await Recommendation.find({
      farmer_id: userId,
      createdAt: { $gte: startDate }
    }).lean();

    // Calculate stats
    const total = recommendations.length;
    const pending = recommendations.filter(r => r.status === 'pending').length;
    const accepted = recommendations.filter(r => r.status === 'accepted').length;
    const rejected = recommendations.filter(r => r.status === 'rejected').length;
    const overridden = recommendations.filter(r => r.status === 'overridden').length;

    // Calculate compliance rate
    const responded = accepted + rejected + overridden;
    const complianceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    // Calculate operational cost saved (based on reduced irrigation time)
    // Assumptions: Each recommendation represents ~1 hour of avoided irrigation
    const COST_PER_HOUR_SAVED = 20; // RM (fuel + electricity + labor)
    let totalEstimated = 0;
    let totalActual = 0;
    recommendations.forEach(r => {
      if (r.status === 'accepted' && r.estimated_water_ml) {
        totalEstimated += r.estimated_water_ml;
        if (r.actual_water_ml) {
          totalActual += r.actual_water_ml;
        }
      }
    });
    const waterVolumeSaved = totalEstimated - totalActual;
    const costSaved = accepted * COST_PER_HOUR_SAVED; // Cost saved from avoided irrigation

    res.json({
      success: true,
      period: `last_${days}_days`,
      stats: {
        total: total,
        pending: pending,
        accepted: accepted,
        rejected: rejected,
        overridden: overridden,
        responded: responded,
        complianceRate: complianceRate,
        totalEstimatedWater: totalEstimated,
        totalActualWater: totalActual,
        waterVolumeSaved: waterVolumeSaved > 0 ? waterVolumeSaved : 0,
        costSaved: costSaved > 0 ? costSaved : 0,
        currency: 'RM'
      }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/recommendations/:id
// Delete a recommendation (admin or owner only)
exports.deleteRecommendation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const recommendation = await Recommendation.findOne({ _id: id, farmer_id: userId });
    if (!recommendation) {
      const error = new Error('Recommendation not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    await recommendation.deleteOne();

    res.json({
      success: true,
      message: 'Recommendation deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recommendations/schedule - Get irrigation schedule
exports.getIrrigationSchedule = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { plotId, days = 7 } = req.query;

    // Build query
    const query = {
      farmer_id: userId,
      status: { $in: ['pending', 'accepted'] }
    };

    if (plotId) {
      query.plot_id = plotId;
    }

    // Get recommendations for next X days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    query.scheduled_time = {
      $gte: new Date(),
      $lte: futureDate
    };

    const schedule = await Recommendation.find(query)
      .populate('plot_id', 'name location crop_type')
      .sort({ scheduled_time: 1 });

    // Group by date
    const scheduleByDate = {};
    
    for (const rec of schedule) {
      const dateKey = new Date(rec.scheduled_time).toISOString().split('T')[0];
      
      if (!scheduleByDate[dateKey]) {
        scheduleByDate[dateKey] = [];
      }

      scheduleByDate[dateKey].push({
        recommendationId: rec._id,
        plotId: rec.plot_id._id,
        plotName: rec.plot_id.name,
        cropType: rec.plot_id.crop_type,
        scheduledTime: rec.scheduled_time,
        waterAmount: rec.water_amount,
        duration: rec.watering_duration,
        currentMoisture: rec.current_moisture,
        status: rec.status,
        advice: rec.recommendation_text
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalScheduled: schedule.length,
        days: parseInt(days),
        schedule: scheduleByDate
      }
    });
  } catch (error) {
    next(error);
  }
};
