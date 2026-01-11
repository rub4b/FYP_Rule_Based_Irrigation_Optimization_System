const SensorData = require('../models/SensorData');
const Plot = require('../models/Plot');

// POST /api/sensors/sync
exports.syncSensorData = async (req, res) => {
  try {
    const { sensor_id, readings } = req.body;

    if (!sensor_id || !readings || !Array.isArray(readings)) {
      return res.status(400).json({ 
        success: false, 
        error: 'sensor_id and readings array are required' 
      });
    }

    // Calculate timestamps backwards from now (60-minute intervals)
    const now = new Date();
    const sensorDataArray = readings.map((reading, index) => {
      // Oldest reading gets the furthest timestamp back
      const minutesBack = (readings.length - 1 - index) * 60;
      const timestamp = new Date(now.getTime() - minutesBack * 60 * 1000);

      return {
        sensor_id,
        moisture_value: reading.moisture_value || reading,
        timestamp,
        sync_metadata: {
          is_offline_sync: reading.is_offline_sync || true
        }
      };
    });

    // Insert all sensor data into database
    await SensorData.insertMany(sensorDataArray);

    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing sensor data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync sensor data' 
    });
  }
};

// POST /api/sensors/manual
exports.manualSensorInput = async (req, res) => {
  try {
    const { sensor_id, moisture_value } = req.body;

    if (!sensor_id || moisture_value === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'sensor_id and moisture_value are required' 
      });
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
    console.error('Error saving manual sensor data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save manual sensor data' 
    });
  }
};

// GET /api/sensor/logs
exports.getSensorLogs = async (req, res) => {
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
    console.error('Error fetching sensor logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sensor logs' 
    });
  }
};
