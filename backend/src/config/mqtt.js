const mqtt = require('mqtt');
const logger = require('./logger');
const { MQTT } = require('./env');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscribers = new Map(); // Topic -> callback function
  }

  // Initialize MQTT connection
  connect() {
    const options = {
      host: MQTT.HOST,
      port: MQTT.PORT,
      protocol: MQTT.PROTOCOL,
      username: MQTT.USERNAME || '',
      password: MQTT.PASSWORD || '',
      clientId: `aquametic_server_${Math.random().toString(16).slice(3)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };

    logger.info(`Connecting to MQTT broker at ${options.host}:${options.port}`);

    this.client = mqtt.connect(options);

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('✓ Connected to MQTT broker successfully');
      
      // Subscribe to all sensor topics
      this.subscribeToSensorTopics();
    });

    this.client.on('error', (error) => {
      logger.error('MQTT connection error:', error);
      this.isConnected = false;
    });

    this.client.on('offline', () => {
      logger.warn('MQTT client is offline');
      this.isConnected = false;
    });

    this.client.on('reconnect', () => {
      logger.info('Attempting to reconnect to MQTT broker...');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    return this.client;
  }

  // Subscribe to sensor data topics
  subscribeToSensorTopics() {
    const topics = [
      'aquametic/sensor/+/data',  // All sensor data (+ is wildcard for sensor ID)
      'aquametic/sensor/+/status', // Sensor status updates
      'aquametic/device/+/online', // Device online/offline status
    ];

    topics.forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          logger.info(`Subscribed to MQTT topic: ${topic}`);
        }
      });
    });
  }

  // Handle incoming MQTT messages
  handleMessage(topic, message) {
    try {
      const messageString = message.toString();
      logger.info(`Raw MQTT message on ${topic}: "${messageString}"`);
      
      const data = JSON.parse(messageString);
      logger.debug(`Parsed MQTT data:`, data);

      // Notify all registered subscribers for this topic
      const topicPattern = this.getTopicPattern(topic);
      const callbacks = this.subscribers.get(topicPattern) || [];
      
      callbacks.forEach(callback => {
        try {
          callback(topic, data);
        } catch (error) {
          logger.error('Error in MQTT subscriber callback:', error);
        }
      });

    } catch (error) {
      logger.error(`Failed to parse MQTT message from ${topic}. Raw message: "${message.toString()}", Error:`, error.message);
    }
  }

  // Get topic pattern (replace specific IDs with wildcards)
  getTopicPattern(topic) {
    const parts = topic.split('/');
    return parts.map((part, index) => {
      // Keep first two levels, wildcard for sensor IDs
      if (index === 2) return '+';
      return part;
    }).join('/');
  }

  // Register a callback for specific topic pattern
  subscribe(topicPattern, callback) {
    if (!this.subscribers.has(topicPattern)) {
      this.subscribers.set(topicPattern, []);
    }
    this.subscribers.get(topicPattern).push(callback);
    logger.info(`Registered subscriber for topic pattern: ${topicPattern}`);
  }

  // Publish message to MQTT topic
  publish(topic, message, options = {}) {
    if (!this.isConnected) {
      logger.error('Cannot publish - MQTT client not connected');
      return Promise.reject(new Error('MQTT client not connected'));
    }

    return new Promise((resolve, reject) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      
      this.client.publish(topic, payload, { qos: 1, ...options }, (error) => {
        if (error) {
          logger.error(`Failed to publish to ${topic}:`, error);
          reject(error);
        } else {
          logger.debug(`Published message to ${topic}`);
          resolve();
        }
      });
    });
  }

  // Send command to specific device
  async sendDeviceCommand(sensorId, command, data = {}) {
    const topic = `aquametic/device/${sensorId}/command`;
    const message = {
      command,
      data,
      timestamp: new Date().toISOString()
    };
    
    logger.info(`Sending command '${command}' to device ${sensorId}`);
    return this.publish(topic, message);
  }

  // Disconnect from MQTT broker
  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      logger.info('Disconnected from MQTT broker');
    }
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
}

// Create singleton instance
const mqttService = new MQTTService();

module.exports = mqttService;
