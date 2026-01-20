const SensorData = require('../models/SensorData');
const Plot = require('../models/Plot');
const SystemSettings = require('../models/SystemSettings');
const logger = require('../config/logger');
const { MOISTURE } = require('../config/constants');

class MQTTHandler {
  constructor(mqttService, io) {
    this.mqttService = mqttService;
    this.io = io; // Socket.io instance for real-time updates
    this.setupSubscriptions();
  }

  setupSubscriptions() {
    // Subscribe to sensor data messages
    this.mqttService.subscribe('aquametic/sensor/+/data', (topic, data) => {
      this.handleSensorData(topic, data);
    });

    // Subscribe to sensor status updates
    this.mqttService.subscribe('aquametic/sensor/+/status', (topic, data) => {
      this.handleSensorStatus(topic, data);
    });

    // Subscribe to device online/offline status
    this.mqttService.subscribe('aquametic/device/+/online', (topic, data) => {
      this.handleDeviceStatus(topic, data);
    });

    logger.info('MQTT handlers initialized and subscribed to topics');
  }

  // Handle incoming sensor data
  async handleSensorData(topic, data) {
    try {
      // Extract sensor ID from topic: aquametic/sensor/{sensorId}/data
      const sensorId = topic.split('/')[2];
      
      logger.info(`Processing sensor data from ${sensorId}. Raw moisture: ${data.moisture}, Type: ${typeof data.moisture}`);

      // Extract moisture value - use hasOwnProperty to handle zero values correctly
      let moistureValue = data.hasOwnProperty('moisture') ? data.moisture : data.moisture_value;
      
      // Handle string numbers
      if (typeof moistureValue === 'string') {
        moistureValue = parseFloat(moistureValue);
      }

      // Validate data
      if (moistureValue === undefined || moistureValue === null || typeof moistureValue !== 'number' || isNaN(moistureValue)) {
        logger.error(`Invalid sensor data - missing or invalid moisture value. moistureValue: ${moistureValue}, type: ${typeof moistureValue}`);
        return;
      }

      // Save to database - Always use server timestamp (device timestamp is unreliable)
      const sensorReading = new SensorData({
        sensor_id: sensorId,
        moisture_value: moistureValue,
        timestamp: new Date(), // Use server time, not device time
        sync_metadata: {
          is_offline_sync: data.isOfflineSync || false
        }
      });

      await sensorReading.save();
      logger.info(`Saved sensor reading from ${sensorId}: ${moistureValue}%`);

      // Update plot's current moisture
      await Plot.findOneAndUpdate(
        { sensor_id: sensorId },
        { current_moisture: data.moisture },
        { new: true }
      );

      // Emit real-time update via Socket.io
      this.io.emit('sensorData', {
        sensorId,
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity,
        timestamp: sensorReading.timestamp
      });

      // Check for critical moisture levels
      await this.checkCriticalLevels(sensorId, data.moisture);

    } catch (error) {
      logger.error('Error handling sensor data:', error);
    }
  }

  // Handle sensor status updates
  async handleSensorStatus(topic, data) {
    try {
      const sensorId = topic.split('/')[2];
      logger.info(`Sensor status update from ${sensorId}:`, data);

      // Emit status update via Socket.io
      this.io.emit('sensorStatus', {
        sensorId,
        status: data.status,
        battery: data.battery,
        signal: data.signal,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error handling sensor status:', error);
    }
  }

  // Handle device online/offline status
  async handleDeviceStatus(topic, data) {
    try {
      const deviceId = topic.split('/')[2];
      const isOnline = data.online === true;
      
      logger.info(`Device ${deviceId} is now ${isOnline ? 'online' : 'offline'}`);

      // Emit device status via Socket.io
      this.io.emit('deviceStatus', {
        deviceId,
        online: isOnline,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error handling device status:', error);
    }
  }

  // Check for critical moisture levels and send alerts
  async checkCriticalLevels(sensorId, moisture) {
    try {
      // Get critical thresholds from SystemSettings
      const settings = await SystemSettings.findOne({ category: 'NOTIFICATIONS' });
      const CRITICAL_LOW = settings?.settings?.criticalAlertThreshold || MOISTURE.CRITICAL_LOW;
      const CRITICAL_HIGH = MOISTURE.CRITICAL_HIGH; // High threshold from constants

      if (moisture < CRITICAL_LOW || moisture > CRITICAL_HIGH) {
        const plot = await Plot.findOne({ sensor_id: sensorId })
          .populate('farmer_id', 'email name');

        if (plot && plot.farmer_id) {
          logger.warn(`Critical moisture level detected for plot ${plot.name}: ${moisture}%`);

          // Emit critical alert via Socket.io
          this.io.emit('criticalAlert', {
            plotId: plot._id,
            plotName: plot.name,
            sensorId,
            moisture,
            level: moisture < CRITICAL_LOW ? 'low' : 'high',
            timestamp: new Date()
          });

          // Note: Email alerts are handled by alertJob.js which also uses SystemSettings
        }
      }
    } catch (error) {
      logger.error('Error checking critical levels:', error);
    }
  }

  // Send command to device via MQTT
  async sendCommand(sensorId, command, data = {}) {
    try {
      await this.mqttService.sendDeviceCommand(sensorId, command, data);
      logger.info(`Command sent to ${sensorId}: ${command}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to send command to ${sensorId}:`, error);
      throw error;
    }
  }
}

module.exports = MQTTHandler;
