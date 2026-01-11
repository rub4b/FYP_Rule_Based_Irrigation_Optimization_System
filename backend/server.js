const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Allow requests from anywhere
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/backend_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.error('----------------------------------------------------');
    console.error('HINT: If you are using MongoDB Atlas, check if your Current IP Address is added to the Network Access Allowlist.');
    console.error('HINT: Check if you have a stable internet connection.');
    console.error('----------------------------------------------------');
  });

// API Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Backend API is running' });
});

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const sensorRoutes = require('./src/routes/sensorRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const plotRoutes = require('./src/routes/plotRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes'); // Added Analytics
const errorHandler = require('./src/middleware/errorHandler');
const alertJob = require('./src/jobs/alertJob'); // Import Background Job

// Start Background Jobs
alertJob.start();

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/sensor', sensorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/analytics', analyticsRoutes); // Use Analytics Routes

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
