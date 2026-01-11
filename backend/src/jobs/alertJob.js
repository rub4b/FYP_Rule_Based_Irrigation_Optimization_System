const cron = require('node-cron');
const Plot = require('../models/Plot');
const User = require('../models/User');
const SensorData = require('../models/SensorData');
const emailService = require('../services/emailService');

// Run every hour
const job = cron.schedule('0 * * * *', async () => {
  console.log('Running background moisture check job...');
  
  try {
    // Get all plots
    const plots = await Plot.find({});
    
    for (const plot of plots) {
      if (!plot.sensor_id) continue;

      // Get latest reading
      const latestData = await SensorData.findOne({ sensor_id: plot.sensor_id })
        .sort({ timestamp: -1 });
        
      if (!latestData) continue;
      
      // CRITICAL THRESHOLD CHECK (e.g., < 20%)
      if (latestData.moisture_value < 20) {
        // Find farmer to get email
        const farmer = await User.findById(plot.farmer_id);
        
        if (farmer && farmer.email) {
          console.log(`Sending alert for plot ${plot.name} to ${farmer.email}`);
          
          await emailService.sendEmail(
            farmer.email,
            `🚨 CRITICAL: Low Moisture in ${plot.name}`,
            `Hello ${farmer.name},\n\nYour plot "${plot.name}" has critically low soil moisture (${latestData.moisture_value}%).\n\nPlease irrigate immediately to prevent crop damage.\n\n- Aquametic System`
          );
        }
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
