const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const axios = require('axios');

// GET /api/plots - Get all plots for the authenticated user with weather data
exports.getAllPlots = async (req, res, next) => {
  try {
    const userId = req.user.id; // From auth middleware

    // Find all plots for this user
    const plots = await Plot.find({ farmer_id: userId });

    // Enrich each plot with current moisture and weather data
    const enrichedPlots = await Promise.all(plots.map(async (plot) => {
      // Get latest sensor data from any of the plot's sensors
      let latestSensorData = null;
      try {
        const sensorIds = plot.sensor_ids && plot.sensor_ids.length > 0 ? plot.sensor_ids : [plot.sensor_id];
        latestSensorData = await SensorData.findOne({ sensor_id: { $in: sensorIds } })
          .sort({ timestamp: -1 })
          .limit(1);
      } catch (err) {
        console.warn(`Failed to fetch sensor data for plot ${plot._id}: ${err.message}`);
      }

      const currentMoisture = latestSensorData ? latestSensorData.moisture_value : 0;

      // Parse location and fetch weather
      let weather = {
        temperature: null,
        humidity: null,
        precipitation_probability: null,
        wind_speed: null
      };
      
      let rainProbability = 0;

      try {
        if (!plot.location) throw new Error('No location data');
        
        const locationParts = plot.location.split(',').map(coord => parseFloat(coord.trim()));
        if (locationParts.length === 2 && !isNaN(locationParts[0]) && !isNaN(locationParts[1])) {
          const [lat, lng] = locationParts;
          
          // Fetch weather data from Open-Meteo with current and forecast data
          // Set timeout to prevent hanging
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_probability_max&timezone=auto`;
          const weatherResponse = await axios.get(weatherUrl, { timeout: 3000 });
          
          const current = weatherResponse.data.current;
          const daily = weatherResponse.data.daily;
          
          weather.temperature = current?.temperature_2m || null;
          weather.humidity = current?.relative_humidity_2m || null;
          weather.wind_speed = current?.wind_speed_10m || null;
          weather.precipitation_probability = daily?.precipitation_probability_max?.[0] || null;
          rainProbability = weather.precipitation_probability || 0;
        }
      } catch (weatherError) {
        // Log lightly, don't spam console if API is down
        // console.warn(`Error fetching weather for plot ${plot._id}:`, weatherError.message);
        // Continue with null weather data
      }
      
      // Smart Irrigation Logic (crop-specific thresholds)
      let irrigationStatus, irrigationAdvice, colorCode;
      
      // Crop-specific moisture thresholds (when to irrigate)
      const CROP_THRESHOLDS = {
        'rice': { critical: 50, irrigate: 60 },      // Rice paddies need high moisture
        'sugarcane': { critical: 40, irrigate: 50 }, // Sugarcane needs high moisture
        'corn': { critical: 30, irrigate: 40 },      // Corn moderate
        'vegetable': { critical: 30, irrigate: 40 }, // Vegetables need consistent moisture
        'soybean': { critical: 25, irrigate: 35 },   // Soybean moderate-low
        'cotton': { critical: 20, irrigate: 30 },    // Cotton drought-tolerant
        'wheat': { critical: 20, irrigate: 30 },     // Wheat drought-tolerant
        'default': { critical: 20, irrigate: 40 }    // Default thresholds
      };
      
      // Get crop-specific thresholds
      const cropType = (plot.crop_type || '').toLowerCase();
      const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS['default'];
      
      if (currentMoisture < thresholds.critical) {
        // CRITICAL (Red)
        irrigationStatus = 'CRITICAL';
        irrigationAdvice = '🚨 Critical! Irrigate immediately.';
        colorCode = '#dc3545'; // Red
      } else if (currentMoisture < thresholds.irrigate && rainProbability > 50) {
        // WAIT (Orange)
        irrigationStatus = 'WAIT';
        irrigationAdvice = '☁️ Rain predicted. Wait to save water.';
        colorCode = '#fd7e14'; // Orange
      } else if (currentMoisture < thresholds.irrigate && rainProbability <= 50) {
        // IRRIGATE (Blue)
        irrigationStatus = 'IRRIGATE';
        irrigationAdvice = '💧 Soil dry. Start irrigation.';
        colorCode = '#0dcaf0'; // Blue
      } else {
        // GOOD (Green)
        irrigationStatus = 'GOOD';
        irrigationAdvice = '✅ Moisture levels healthy.';
        colorCode = '#28a745'; // Green
      }

      return {
        _id: plot._id,
        name: plot.name,
        farmer_id: plot.farmer_id,
        sensor_id: plot.sensor_id,
        sensor_ids: plot.sensor_ids || [plot.sensor_id],
        location: plot.location,
        crop_type: plot.crop_type,
        size_acres: plot.size_acres || 2.5,
        number_of_sensors: plot.number_of_sensors || 1,
        current_moisture: currentMoisture,
        weather: weather,
        irrigation_status: irrigationStatus,
        irrigation_advice: irrigationAdvice,
        color_code: colorCode
      };
    }));

    res.json({
      success: true,
      plots: enrichedPlots
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/plots - Create a new plot
exports.createPlot = async (req, res, next) => {
  try {
    const { name, crop_type, location, sensor_id, sensor_ids, size_acres, number_of_sensors } = req.body;

    // Validation: Ensure name is not empty
    if (!name || name.trim() === '') {
      const error = new Error('Plot name is required and cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    // Validate sensor IDs (accept either sensor_ids array or single sensor_id)
    let finalSensorIds = [];
    if (sensor_ids && Array.isArray(sensor_ids) && sensor_ids.length > 0) {
      finalSensorIds = sensor_ids;
    } else if (sensor_id) {
      finalSensorIds = [sensor_id];
    } else {
      const error = new Error('At least one sensor ID is required');
      error.statusCode = 400;
      throw error;
    }

    // Convert location object {lat, lng} to string format
    let locationString = '';
    if (location && location.lat !== undefined && location.lng !== undefined) {
      locationString = `${location.lat}, ${location.lng}`;
    } else {
       // If standard format is not sent, check if it's already a string or handle error
       if (typeof location === 'string' && location.includes(',')) {
         locationString = location;
       } else {
         const error = new Error('Location with lat and lng is required');
         error.statusCode = 400;
         throw error;
       }
    }

    // Check if sensor ID is already in use by another plot?
    // Depending on logic, multiple plots might use same sensor or not. Assuming 1:1 for now, but not enforcing unique constraint at DB level blindly.
    
    // Create new plot linked to the authenticated user
    const plot = new Plot({
      name: name.trim(),
      farmer_id: req.user.id, // From auth middleware
      sensor_id: finalSensorIds[0], // Primary sensor for backward compatibility
      sensor_ids: finalSensorIds,
      location: locationString,
      crop_type: crop_type || '', // Optional field
      size_acres: size_acres || 2.5, // Default to 2.5 acres (~1 hectare)
      number_of_sensors: number_of_sensors || finalSensorIds.length
    });

    await plot.save();

    res.status(201).json({ 
      success: true, 
      message: 'Plot created successfully',
      plot 
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plots/:id - Delete a plot
exports.deletePlot = async (req, res, next) => {
  try {
    const plotId = req.params.id;

    // Find the plot
    const plot = await Plot.findById(plotId);

    if (!plot) {
      const error = new Error('Plot not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if the plot belongs to the authenticated user
    if (plot.farmer_id.toString() !== req.user.id) {
      const error = new Error('You are not authorized to delete this plot');
      error.statusCode = 403;
      throw error;
    }

    // Delete the plot
    await Plot.findByIdAndDelete(plotId);

    res.json({ 
      success: true, 
      message: 'Plot deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/plots/:id/advice - Get irrigation advice for a plot
exports.getPlotAdvice = async (req, res, next) => {
  try {
    const plotId = req.params.id;

    // Find the plot
    const plot = await Plot.findById(plotId);

    if (!plot) {
      const error = new Error('Plot not found');
      error.statusCode = 404;
      throw error;
    }

    // Parse location from string format "lat, lng"
    let lat, lng;
    try {
      const locationParts = plot.location.split(',').map(coord => parseFloat(coord.trim()));
      if (locationParts.length !== 2 || isNaN(locationParts[0]) || isNaN(locationParts[1])) {
         throw new Error('Invalid location');
      }
      [lat, lng] = locationParts;
    } catch(e) {
      const error = new Error('Invalid plot location format');
      error.statusCode = 400;
      throw error;
    }

    // Get latest sensor data for this plot
    const latestSensorData = await SensorData.findOne({ sensor_id: plot.sensor_id })
      .sort({ timestamp: -1 })
      .limit(1);

    if (!latestSensorData) {
      const error = new Error('No sensor data available for this plot');
      error.statusCode = 404;
      throw error;
    }

    const moisture = latestSensorData.moisture_value;

    // Fetch weather data from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,precipitation_probability_max&timezone=auto`;
    
    let rainProbability = 0;
    let rainAmount = 0;

    try {
      // 3 second timeout for weather
      const weatherResponse = await axios.get(weatherUrl, { timeout: 3000 });
      const dailyData = weatherResponse.data.daily;
      
      // Get today's forecast (first entry in the array)
      if (dailyData && dailyData.precipitation_probability_max && dailyData.precipitation_probability_max[0] !== undefined) {
        rainProbability = dailyData.precipitation_probability_max[0];
      }
      
      if (dailyData && dailyData.precipitation_sum && dailyData.precipitation_sum[0] !== undefined) {
        rainAmount = dailyData.precipitation_sum[0];
      }
    } catch (weatherError) {
      // console.error('Error fetching weather data:', weatherError);
      // Continue with default values (0) if weather API fails
    }

    // Implement Smart Irrigation Logic (crop-specific thresholds)
    let status, advice, colorCode;

    // Crop-specific moisture thresholds (when to irrigate)
    const CROP_THRESHOLDS = {
      'rice': { critical: 50, irrigate: 60 },      // Rice paddies need high moisture
      'sugarcane': { critical: 40, irrigate: 50 }, // Sugarcane needs high moisture
      'corn': { critical: 30, irrigate: 40 },      // Corn moderate
      'vegetable': { critical: 30, irrigate: 40 }, // Vegetables need consistent moisture
      'soybean': { critical: 25, irrigate: 35 },   // Soybean moderate-low
      'cotton': { critical: 20, irrigate: 30 },    // Cotton drought-tolerant
      'wheat': { critical: 20, irrigate: 30 },     // Wheat drought-tolerant
      'default': { critical: 20, irrigate: 40 }    // Default thresholds
    };
    
    // Get crop-specific thresholds
    const cropType = (plot.crop_type || '').toLowerCase();
    const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS['default'];

    if (moisture < thresholds.critical) {
      // CRITICAL (Red)
      status = 'CRITICAL';
      advice = '🚨 Critical! Irrigate immediately.';
      colorCode = '#dc3545'; // Red
    } else if (moisture < thresholds.irrigate && rainProbability > 50) {
      // WAIT (Orange)
      status = 'WAIT';
      advice = '☁️ Rain predicted. Wait to save water.';
      colorCode = '#fd7e14'; // Orange
    } else if (moisture < thresholds.irrigate && rainProbability <= 50) {
      // IRRIGATE (Blue)
      status = 'IRRIGATE';
      advice = '💧 Soil dry. Start irrigation.';
      colorCode = '#0dcaf0'; // Blue
    } else {
      // GOOD (Green)
      status = 'GOOD';
      advice = '✅ Moisture levels healthy.';
      colorCode = '#28a745'; // Green
    }

    res.json({
      success: true,
      status,
      advice,
      weather: {
        rain_prob: rainProbability,
        rain_amount: rainAmount
      },
      color_code: colorCode,
      current_moisture: moisture,
      plot_name: plot.name
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/plots/:id - Get a single plot by ID
exports.getPlotById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const plot = await Plot.findOne({ _id: id, farmer_id: userId });

    if (!plot) {
      const error = new Error('Plot not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      plot: {
        _id: plot._id,
        name: plot.name,
        farmer_id: plot.farmer_id,
        sensor_id: plot.sensor_id,
        location: plot.location,
        crop_type: plot.crop_type,
        area: plot.area
      }
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/plots/:id - Update a plot
exports.updatePlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, crop_type, location, sensor_id, sensor_ids, size_acres, number_of_sensors } = req.body;

    // Find the plot and verify ownership
    const plot = await Plot.findOne({ _id: id, farmer_id: userId });

    if (!plot) {
      const error = new Error('Plot not found');
      error.statusCode = 404;
      throw error;
    }

    // Validate name is not empty
    if (!name || name.trim() === '') {
      const error = new Error('Plot name is required and cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    // Update plot fields
    plot.name = name.trim();
    if (crop_type !== undefined) plot.crop_type = crop_type.trim();
    if (location !== undefined) plot.location = location.trim();
    if (size_acres !== undefined && size_acres !== null) {
      plot.size_acres = parseFloat(size_acres);
    }
    if (number_of_sensors !== undefined && number_of_sensors !== null) {
      plot.number_of_sensors = parseInt(number_of_sensors);
    }
    
    // Update sensor IDs if provided
    if (sensor_ids && Array.isArray(sensor_ids) && sensor_ids.length > 0) {
      plot.sensor_ids = sensor_ids;
      plot.sensor_id = sensor_ids[0]; // Update primary sensor for backward compatibility
    } else if (sensor_id) {
      plot.sensor_id = sensor_id;
      if (!plot.sensor_ids || plot.sensor_ids.length === 0) {
        plot.sensor_ids = [sensor_id];
      }
    }

    await plot.save();

    res.json({
      success: true,
      message: 'Plot updated successfully',
      plot: {
        _id: plot._id,
        name: plot.name,
        farmer_id: plot.farmer_id,
        sensor_id: plot.sensor_id,
        sensor_ids: plot.sensor_ids,
        location: plot.location,
        crop_type: plot.crop_type,
        size_acres: plot.size_acres,
        number_of_sensors: plot.number_of_sensors
      }
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/plots/:id/thresholds - Update plot-specific irrigation thresholds
exports.updatePlotThresholds = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const plotId = req.params.id;
    const { moistureMin, moistureCritical, moistureOptimalMin, moistureOptimalMax } = req.body;

    const plot = await Plot.findOne({ _id: plotId, farmer_id: userId });

    if (!plot) {
      const error = new Error('Plot not found or you do not have access');
      error.statusCode = 404;
      throw error;
    }

    // Validate thresholds
    if (moistureMin !== undefined) plot.thresholds.moistureMin = moistureMin;
    if (moistureCritical !== undefined) plot.thresholds.moistureCritical = moistureCritical;
    if (moistureOptimalMin !== undefined) plot.thresholds.moistureOptimalMin = moistureOptimalMin;
    if (moistureOptimalMax !== undefined) plot.thresholds.moistureOptimalMax = moistureOptimalMax;

    await plot.save();

    // Log audit
    const { logAudit } = require('../middleware/auditLogger');
    await logAudit({
      userId: req.user.id,
      action: 'THRESHOLD_UPDATE',
      resource: 'Plot',
      resourceId: plot._id.toString(),
      details: {
        plotName: plot.name,
        newThresholds: plot.thresholds
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'SUCCESS'
    });

    res.status(200).json({
      success: true,
      message: 'Plot thresholds updated successfully',
      data: {
        plotId: plot._id,
        thresholds: plot.thresholds
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/plots/:id/sensor-status - Get sensor status for a plot
exports.getPlotSensorStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const plotId = req.params.id;

    const plot = await Plot.findOne({ _id: plotId, farmer_id: userId });

    if (!plot) {
      const error = new Error('Plot not found or you do not have access');
      error.statusCode = 404;
      throw error;
    }

    const sensorIds = plot.sensor_ids && plot.sensor_ids.length > 0 ? plot.sensor_ids : [plot.sensor_id];
    
    // Get last data timestamp for each sensor
    const sensorStatuses = await Promise.all(sensorIds.map(async (sensorId) => {
      if (!sensorId) return null;
      
      const lastData = await SensorData.findOne({ sensor_id: sensorId })
        .sort({ timestamp: -1 })
        .limit(1);

      if (!lastData) {
        return {
          sensorId,
          status: 'no_data',
          lastSeen: null,
          message: 'No data received yet'
        };
      }

      const now = new Date();
      const lastSeen = new Date(lastData.timestamp);
      const minutesSinceLastData = (now - lastSeen) / (1000 * 60);

      let status, message;
      if (minutesSinceLastData < 5) {
        status = 'online';
        message = 'Active';
      } else if (minutesSinceLastData < 60) {
        status = 'recent';
        message = `Last seen ${Math.round(minutesSinceLastData)} minutes ago`;
      } else if (minutesSinceLastData < 1440) {
        status = 'delayed';
        message = `Last seen ${Math.round(minutesSinceLastData / 60)} hours ago`;
      } else {
        status = 'offline';
        message = `Offline for ${Math.round(minutesSinceLastData / 1440)} days`;
      }

      return {
        sensorId,
        status,
        lastSeen: lastData.timestamp,
        minutesSinceLastData: Math.round(minutesSinceLastData),
        message,
        lastMoisture: lastData.moisture_value,
        lastTemperature: lastData.temperature
      };
    }));

    const activeSensors = sensorStatuses.filter(s => s && s.status === 'online').length;
    const totalSensors = sensorStatuses.filter(s => s !== null).length;

    res.status(200).json({
      success: true,
      data: {
        plotId: plot._id,
        plotName: plot.name,
        totalSensors,
        activeSensors,
        sensors: sensorStatuses.filter(s => s !== null)
      }
    });
  } catch (error) {
    next(error);
  }
};


