const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const axios = require('axios');

// GET /api/plots - Get all plots for the authenticated user with weather data
exports.getAllPlots = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    // Find all plots for this user
    const plots = await Plot.find({ farmer_id: userId });

    // Enrich each plot with current moisture and weather data
    const enrichedPlots = await Promise.all(plots.map(async (plot) => {
      // Get latest sensor data
      const latestSensorData = await SensorData.findOne({ sensor_id: plot.sensor_id })
        .sort({ timestamp: -1 })
        .limit(1);

      const currentMoisture = latestSensorData ? latestSensorData.moisture_value : 0;

      // Parse location and fetch weather
      let weather = {
        temperature: null,
        humidity: null,
        precipitation_probability: null,
        wind_speed: null
      };

      try {
        const locationParts = plot.location.split(',').map(coord => parseFloat(coord.trim()));
        if (locationParts.length === 2 && !isNaN(locationParts[0]) && !isNaN(locationParts[1])) {
          const [lat, lng] = locationParts;
          
          // Fetch weather data from Open-Meteo with current and forecast data
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_probability_max&timezone=auto`;
          const weatherResponse = await axios.get(weatherUrl);
          
          const current = weatherResponse.data.current;
          const daily = weatherResponse.data.daily;
          
          weather.temperature = current?.temperature_2m || null;
          weather.humidity = current?.relative_humidity_2m || null;
          weather.wind_speed = current?.wind_speed_10m || null;
          weather.precipitation_probability = daily?.precipitation_probability_max?.[0] || null;
        }
      } catch (weatherError) {
        console.error(`Error fetching weather for plot ${plot._id}:`, weatherError.message);
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
    console.error('Error fetching plots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plots'
    });
  }
};

// POST /api/plots - Create a new plot
exports.createPlot = async (req, res) => {
  try {
    const { name, crop_type, location, sensor_id } = req.body;

    // Validation: Ensure name is not empty
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Plot name is required and cannot be empty' 
      });
    }

    // Validate sensor_id
    if (!sensor_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Sensor ID is required' 
      });
    }

    // Convert location object {lat, lng} to string format
    let locationString = '';
    if (location && location.lat !== undefined && location.lng !== undefined) {
      locationString = `${location.lat}, ${location.lng}`;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Location with lat and lng is required' 
      });
    }

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
    console.error('Error creating plot:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create plot' 
    });
  }
};

// DELETE /api/plots/:id - Delete a plot
exports.deletePlot = async (req, res) => {
  try {
    const plotId = req.params.id;

    // Find the plot
    const plot = await Plot.findById(plotId);

    if (!plot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Plot not found' 
      });
    }

    // Check if the plot belongs to the authenticated user
    if (plot.farmer_id.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not authorized to delete this plot' 
      });
    }

    // Delete the plot
    await Plot.findByIdAndDelete(plotId);

    res.json({ 
      success: true, 
      message: 'Plot deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting plot:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete plot' 
    });
  }
};

// GET /api/plots/:id/advice - Get irrigation advice for a plot
exports.getPlotAdvice = async (req, res) => {
  try {
    const plotId = req.params.id;

    // Find the plot
    const plot = await Plot.findById(plotId);

    if (!plot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Plot not found' 
      });
    }

    // Parse location from string format "lat, lng"
    const locationParts = plot.location.split(',').map(coord => parseFloat(coord.trim()));
    if (locationParts.length !== 2 || isNaN(locationParts[0]) || isNaN(locationParts[1])) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid plot location format' 
      });
    }

    const [lat, lng] = locationParts;

    // Get latest sensor data for this plot
    const latestSensorData = await SensorData.findOne({ sensor_id: plot.sensor_id })
      .sort({ timestamp: -1 })
      .limit(1);

    if (!latestSensorData) {
      return res.status(404).json({ 
        success: false, 
        error: 'No sensor data available for this plot' 
      });
    }

    const moisture = latestSensorData.moisture_value;

    // Fetch weather data from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,precipitation_probability_max&timezone=auto`;
    
    let rainProbability = 0;
    let rainAmount = 0;

    try {
      const weatherResponse = await axios.get(weatherUrl);
      const dailyData = weatherResponse.data.daily;
      
      // Get today's forecast (first entry in the array)
      if (dailyData && dailyData.precipitation_probability_max && dailyData.precipitation_probability_max[0] !== undefined) {
        rainProbability = dailyData.precipitation_probability_max[0];
      }
      
      if (dailyData && dailyData.precipitation_sum && dailyData.precipitation_sum[0] !== undefined) {
        rainAmount = dailyData.precipitation_sum[0];
      }
    } catch (weatherError) {
      console.error('Error fetching weather data:', weatherError);
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
    console.error('Error getting plot advice:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get irrigation advice' 
    });
  }
};

// GET /api/plots/:id - Get a single plot by ID
exports.getPlotById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const plot = await Plot.findOne({ _id: id, farmer_id: userId });

    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
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
    console.error('Error fetching plot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plot'
    });
  }
};

// PUT /api/plots/:id - Update a plot
exports.updatePlot = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, crop_type, location, area } = req.body;

    // Find the plot and verify ownership
    const plot = await Plot.findOne({ _id: id, farmer_id: userId });

    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }

    // Validate name is not empty
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Plot name is required and cannot be empty'
      });
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
    console.error('Error updating plot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update plot'
    });
  }
};

