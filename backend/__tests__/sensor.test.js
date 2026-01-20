const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const sensorRoutes = require('../src/routes/sensorRoutes');
const SensorData = require('../src/models/SensorData');
const Plot = require('../src/models/Plot');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/sensor', sensorRoutes);

process.env.JWT_SECRET = 'test_secret_key';

describe('Sensor Controller Tests', () => {
  let testUser;
  let testPlot;
  let authToken;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/aquametic_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await SensorData.deleteMany({});
    await Plot.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SensorData.deleteMany({});
    await Plot.deleteMany({});
    await User.deleteMany({});

    // Create test user
    testUser = await User.create({
      username: 'sensortest',
      name: 'Sensor Test',
      email: 'sensor@test.com',
      password: await bcrypt.hash('Test123!', 10),
      role: 'farmer'
    });

    authToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Create test plot
    testPlot = await Plot.create({
      name: 'Test Plot',
      farmer_id: testUser._id,
      sensor_id: 'TEST_SENSOR_01',
      location: 'Test Location',
      current_moisture: 0
    });
  });

  describe('POST /api/sensor/sync', () => {
    it('should save sensor data successfully', async () => {
      const sensorData = {
        plotId: testPlot._id.toString(),
        moisture: 45.5,
        temperature: 25.0,
        humidity: 60.0
      };

      const response = await request(app)
        .post('/api/sensor/sync')
        .send(sensorData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Verify data was saved
      const savedData = await SensorData.findOne({ sensor_id: testPlot.sensor_id });
      expect(savedData).toBeDefined();
      expect(savedData.moisture_value).toBe(45.5);
    });

    it('should fail validation with invalid moisture value', async () => {
      const response = await request(app)
        .post('/api/sensor/sync')
        .send({
          plotId: testPlot._id.toString(),
          moisture: 150 // Invalid: > 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should fail validation with negative moisture', async () => {
      const response = await request(app)
        .post('/api/sensor/sync')
        .send({
          plotId: testPlot._id.toString(),
          moisture: -10
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without plotId', async () => {
      const response = await request(app)
        .post('/api/sensor/sync')
        .send({
          moisture: 50
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should update plot current_moisture', async () => {
      await request(app)
        .post('/api/sensor/sync')
        .send({
          plotId: testPlot._id.toString(),
          moisture: 55.5
        })
        .expect(201);

      const updatedPlot = await Plot.findById(testPlot._id);
      expect(updatedPlot.current_moisture).toBe(55.5);
    });
  });

  describe('POST /api/sensor/manual', () => {
    it('should accept manual sensor input', async () => {
      const response = await request(app)
        .post('/api/sensor/manual')
        .send({
          plotId: testPlot._id.toString(),
          moisture: 40.0
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should enforce same validation as sync endpoint', async () => {
      const response = await request(app)
        .post('/api/sensor/manual')
        .send({
          plotId: testPlot._id.toString(),
          moisture: 101 // Invalid
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/sensor/logs', () => {
    beforeEach(async () => {
      // Create sample sensor data
      const sensorDataEntries = [];
      for (let i = 0; i < 15; i++) {
        sensorDataEntries.push({
          sensor_id: testPlot.sensor_id,
          moisture_value: 30 + i,
          timestamp: new Date(Date.now() - i * 3600000) // 1 hour apart
        });
      }
      await SensorData.insertMany(sensorDataEntries);
    });

    it('should retrieve sensor logs successfully', async () => {
      const response = await request(app)
        .get('/api/sensor/logs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/sensor/logs?limit=5')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should fail with invalid limit', async () => {
      const response = await request(app)
        .get('/api/sensor/logs?limit=5000') // Exceeds max
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow reasonable number of requests', async () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/sensor/sync')
          .send({
            plotId: testPlot._id.toString(),
            moisture: 50 + i
          });
        
        expect(response.status).toBe(201);
      }
    });

    // Note: Full rate limit testing requires time delays
    // This test is illustrative
  });

  describe('Data Integrity', () => {
    it('should store timestamp correctly', async () => {
      const beforeTime = new Date();
      
      await request(app)
        .post('/api/sensor/sync')
        .send({
          plotId: testPlot._id.toString(),
          moisture: 50
        });

      const afterTime = new Date();
      const savedData = await SensorData.findOne({ sensor_id: testPlot.sensor_id });
      
      expect(savedData.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(savedData.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle offline sync flag', async () => {
      await request(app)
        .post('/api/sensor/sync')
        .send({
          plotId: testPlot._id.toString(),
          moisture: 50,
          deviceId: 'PICO_TEST'
        });

      const savedData = await SensorData.findOne({ sensor_id: testPlot.sensor_id });
      expect(savedData.sync_metadata).toBeDefined();
    });
  });
});
