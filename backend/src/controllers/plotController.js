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
      // Get latest sensor data
      let latestSensorData = null;
      try {
        latestSensorData = await SensorData.findOne({ sensor_id: plot.sensor_id })
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
        }
      } catch (weatherError) {
        // Log lightly, don't spam console if API is down
        // console.warn(`Error fetching weather for plot ${plot._id}:`, weatherError.message);
        // Continue with null weather data
      }

      return {
        _id: plot._id,
        name: plot.name,
        farmer_id: plot.farmer_id,
        sensor_id: plot.sensor_id,
        location: plot.location,
        crop_type: plot.crop_type,
        current_moisture: currentMoisture,
        weather: weather
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
    const { name, crop_type, location, sensor_id } = req.body;

    // Validation: Ensure name is not empty
    if (!name || name.trim() === '') {
      const error = new Error('Plot name is required and cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    // Validate sensor_id
    if (!sensor_id) {
      const error = new Error('Sensor ID is required');
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
      sensor_id,
      location: locationString,
      crop_type: crop_type || '' // Optional field
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

    // Implement Smart Irrigation Logic
    let status, advice, colorCode;

    if (moisture < 20) {
      // CRITICAL (Red)
      status = 'CRITICAL';
      advice = '🚨 Critical! Irrigate immediately.';
      colorCode = '#dc3545'; // Red
    } else if (moisture < 40 && rainProbability > 50) {
      // WAIT (Orange)
      status = 'WAIT';
      advice = '☁️ Rain predicted. Wait to save water.';
      colorCode = '#fd7e14'; // Orange
    } else if (moisture < 40 && rainProbability <= 50) {
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
    const { name, crop_type, location, area } = req.body;

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
    if (area !== undefined && area !== null) plot.area = parseFloat(area);

    await plot.save();

    res.json({
      success: true,
      message: 'Plot updated successfully',
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

