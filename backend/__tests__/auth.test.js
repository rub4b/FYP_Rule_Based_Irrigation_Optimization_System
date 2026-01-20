const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('../src/routes/authRoutes');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock environment variables
process.env.JWT_SECRET = 'test_secret_key';
process.env.JWT_EXPIRE = '1h';

// Mock email service to prevent actual emails
jest.mock('../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

describe('Authentication Controller Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/aquametic_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear users before each test
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testfarmer',
        name: 'Test Farmer',
        email: 'test@farmer.com',
        password: 'Test123!',
        role: 'farmer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should fail with validation errors for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test',
          name: 'Test',
          email: 'test@test.com',
          password: '123' // Too weak
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        username: 'testfarmer',
        name: 'Test Farmer',
        email: 'duplicate@test.com',
        password: 'Test123!'
      };

      // Create first user
      await request(app).post('/api/auth/register').send(userData);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...userData, username: 'different' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      await User.create({
        username: 'logintest',
        name: 'Login Test',
        email: 'login@test.com',
        password: hashedPassword,
        role: 'farmer'
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'Test123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('login@test.com');
    });

    it('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Test123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with validation errors for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Test123!'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/forgotpassword', () => {
    beforeEach(async () => {
      await User.create({
        username: 'resettest',
        name: 'Reset Test',
        email: 'reset@test.com',
        password: await bcrypt.hash('Test123!', 10),
        role: 'farmer'
      });
    });

    it('should send password reset email for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({
          email: 'reset@test.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('email');

      // Verify token was set in database
      const user = await User.findOne({ email: 'reset@test.com' });
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
    });

    it('should fail for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({
          email: 'nonexistent@test.com'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'profiletest',
        name: 'Profile Test',
        email: 'profile@test.com',
        password: await bcrypt.hash('Test123!', 10),
        role: 'farmer'
      });

      userId = user._id;
      token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('profile@test.com');
      expect(response.body.user.password).toBeUndefined();
    });

    it('should fail without authorization token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
