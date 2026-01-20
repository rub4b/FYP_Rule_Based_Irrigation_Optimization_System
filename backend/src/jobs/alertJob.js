const cron = require('node-cron');
const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const SystemSettings = require('../models/SystemSettings');
const notificationService = require('../services/notificationService');

// Run every hour
const job = cron.schedule('0 * * * *', async () => {
  console.log('Running background moisture check job...');
  
  try {
    // Get critical threshold from system settings
    const settings = await SystemSettings.findOne({ category: 'NOTIFICATIONS' });
    const criticalThreshold = settings?.settings?.criticalAlertThreshold || 20;

    // Get all plots with farmer populated
    const plots = await Plot.find({}).populate('farmer_id');
    
    for (const plot of plots) {
      if (!plot.sensor_id || !plot.farmer_id) continue;

      // Get latest reading
      const latestData = await SensorData.findOne({ sensor_id: plot.sensor_id })
        .sort({ timestamp: -1 });
        
      if (!latestData) continue;
      
      // Use dynamic threshold from system settings
      if (latestData.moisture_value < criticalThreshold) {
        console.log(`Sending alert for plot ${plot.name} (${latestData.moisture_value}%)`);
        
        // Use centralized notification service (supports email + WebSocket)
        await notificationService.sendCriticalMoistureAlert(
          plot.farmer_id._id,
          plot.name,
          latestData.moisture_value,
          global.io // WebSocket instance for real-time notifications
        );
      }
    }
  } catch (error) {
    console.error('Error in background job:', error);
  }
});

module.exports = {
  start: () => {
    console.log('Background alert job scheduled');
    job.start();
  }
};
