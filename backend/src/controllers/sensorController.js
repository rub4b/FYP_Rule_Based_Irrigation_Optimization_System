const SensorData = require('../models/SensorData');
const Plot = require('../models/Plot');

// POST /api/sensors/sync
exports.syncSensorData = async (req, res, next) => {
  try {
    const { sensor_id, readings } = req.body;

    if (!sensor_id || !readings || !Array.isArray(readings)) {
      const error = new Error('sensor_id and readings array are required');
      error.statusCode = 400;
      throw error;
    }

    // Calculate timestamps backwards from now (60-minute intervals)
    const now = new Date();
    const sensorDataArray = readings.map((reading, index) => {
      // Oldest reading gets the furthest timestamp back
      const minutesBack = (readings.length - 1 - index) * 60;
      const timestamp = new Date(now.getTime() - minutesBack * 60 * 1000);

      // Handle simple value or object input
      const moistureVal = (typeof reading === 'object' && reading !== null) ? reading.moisture_value : reading;

      return {
        sensor_id,
        moisture_value: moistureVal,
        timestamp,
        sync_metadata: {
          is_offline_sync: (reading.is_offline_sync !== undefined) ? reading.is_offline_sync : true
        }
      };
    });

    // Insert all sensor data into database
    await SensorData.insertMany(sensorDataArray);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// POST /api/sensors/manual
exports.manualSensorInput = async (req, res, next) => {
  try {
    const { sensor_id, moisture_value } = req.body;

    if (!sensor_id || moisture_value === undefined) {
      const error = new Error('sensor_id and moisture_value are required');
      error.statusCode = 400;
      throw error;
    }

    // Create new sensor data entry
    const sensorData = new SensorData({
      sensor_id,
      moisture_value,
      timestamp: new Date(),
      sync_metadata: {
        is_offline_sync: false
      }
    });

    await sensorData.save();

    // Update the plot's current_moisture if it exists
    await Plot.findOneAndUpdate(
      { sensor_id },
      { current_moisture: moisture_value }
    );

    res.json({ 
      success: true, 
      data: sensorData,
      message: 'Manual sensor data saved successfully' 
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/sensor/logs
exports.getSensorLogs = async (req, res, next) => {
  try {
    const { sensorId } = req.query;
    
    // Build query - filter by sensorId if provided
    const query = sensorId ? { sensor_id: sensorId } : {};
    
    // Fetch sensor data, sorted by newest first, limited to 50 records
    const logs = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({ 
      success: true, 
      logs,
      count: logs.length
    });
  } catch (error) {
    next(error);
  }
};
