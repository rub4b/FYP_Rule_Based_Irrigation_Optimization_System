const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');
const path = require('path');

// Global error handlers FIRST
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(error);
  process.exit(1);
});

// Load environment variables
dotenv.config();

// Import configurations
const { PORT, MONGO_URI, FRONTEND_URL } = require('./src/config/env');
const logger = require('./src/config/logger');
const mqttService = require('./src/config/mqtt');
const MQTTHandler = require('./src/services/mqttHandler');
const { swaggerUi, swaggerSpec } = require('./src/config/swagger');

const app = express();
const server = http.createServer(app);

// Socket.io configuration with CORS
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors()); // Allow requests from anywhere
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Redirect root to auth page
app.get('/', (req, res) => {
  res.redirect('/auth/index.html');
});

// HTTP request logging with Morgan + Winston
app.use(morgan('combined', { stream: logger.stream }));

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(async () => {
    logger.info('MongoDB connected successfully');
    console.log('MongoDB connected successfully');
    
    // Auto-migrate plots: convert size_hectares to size_acres if needed
    try {
      const Plot = require('./src/models/Plot');
      const plotsToMigrate = await Plot.find({ 
        size_hectares: { $exists: true, $ne: null },
        size_acres: { $exists: false }
      });
      
      if (plotsToMigrate.length > 0) {
        logger.info(`Migrating ${plotsToMigrate.length} plots from hectares to acres...`);
        for (const plot of plotsToMigrate) {
          plot.size_acres = plot.size_hectares * 2.47105; // Convert ha to acres
          await plot.save();
        }
        logger.info('✓ Plot migration completed');
      }
    } catch (migrationError) {
      logger.warn('Plot migration skipped:', migrationError.message);
    }
    
    // Initialize system settings
    try {
      const SystemSettings = require('./src/models/SystemSettings');
      await SystemSettings.initializeDefaults();
      logger.info('✓ System settings initialized');
    } catch (settingsError) {
      logger.warn('System settings initialization skipped:', settingsError.message);
    }
    
    // Initialize MQTT after database connection
    mqttService.connect();
    
    // Initialize MQTT handler with Socket.io
    const mqttHandler = new MQTTHandler(mqttService, io);
    
    // Make mqttHandler available to routes
    app.set('mqttHandler', mqttHandler);
    app.set('io', io);
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    console.error('MongoDB connection error:', err);
    console.error('----------------------------------------------------');
    console.error('HINT: If you are using MongoDB Atlas, check if your Current IP Address is added to the Network Access Allowlist.');
    console.error('HINT: Check if you have a stable internet connection.');
    console.error('----------------------------------------------------');
  });

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
  
  // Allow clients to subscribe to specific plot updates
  socket.on('subscribePlot', (plotId) => {
    socket.join(`plot_${plotId}`);
    logger.info(`Client ${socket.id} subscribed to plot ${plotId}`);
  });
  
  socket.on('unsubscribePlot', (plotId) => {
    socket.leave(`plot_${plotId}`);
    logger.info(`Client ${socket.id} unsubscribed from plot ${plotId}`);
  });
});

// API Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Backend API is running' });
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Aquametic API Documentation'
}));

console.log('Starting to import routes...');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
console.log('✓ Auth routes imported');
const sensorRoutes = require('./src/routes/sensorRoutes');
console.log('✓ Sensor routes imported');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
console.log('✓ Dashboard routes imported');
const plotRoutes = require('./src/routes/plotRoutes');
console.log('✓ Plot routes imported');
const analyticsRoutes = require('./src/routes/analyticsRoutes'); // Added Analytics
console.log('✓ Analytics routes imported');
const recommendationRoutes = require('./src/routes/recommendationRoutes'); // Added Recommendations
console.log('✓ Recommendation routes imported');
const errorHandler = require('./src/middleware/errorHandler');
console.log('✓ Error handler imported');
const alertJob = require('./src/jobs/alertJob'); // Import Background Job
console.log('✓ Alert job imported');

// Start Background Jobs
alertJob.start();

console.log('✓ Alert job started');

// Use routes
app.use('/api/auth', authRoutes);
console.log('✓ Auth routes loaded');
app.use('/api/sensor', sensorRoutes);
console.log('✓ Sensor routes loaded');
app.use('/api/dashboard', dashboardRoutes);
console.log('✓ Dashboard routes loaded');
app.use('/api/plots', plotRoutes);
console.log('✓ Plot routes loaded');
app.use('/api/analytics', analyticsRoutes); // Use Analytics Routes
console.log('✓ Analytics routes loaded');
app.use('/api/recommendations', recommendationRoutes); // Use Recommendation Routes
console.log('✓ Recommendation routes loaded');
app.use('/api/admin', require('./src/routes/adminRoutes')); // Admin routes
console.log('✓ Admin routes loaded');
app.use('/api/settings', require('./src/routes/settingsRoutes')); // Settings routes
console.log('✓ Settings routes loaded');

// Error handling middleware
app.use(errorHandler);

console.log('✓ Error handler loaded');

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for real-time updates`);
});

console.log('✓ Server listen called');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    mqttService.disconnect();
    mongoose.connection.close();
    process.exit(0);
  });
});
