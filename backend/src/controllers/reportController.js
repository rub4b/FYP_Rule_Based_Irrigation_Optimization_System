const PDFDocument = require('pdfkit');
const Plot = require('../models/Plot');
const SensorData = require('../models/SensorData');
const Recommendation = require('../models/Recommendation');

// GET /api/analytics/report/weekly
// Generate and download weekly PDF report
exports.generateWeeklyReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { plotId } = req.query;

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Get user's plots
    const plotQuery = { farmer_id: userId };
    if (plotId) plotQuery._id = plotId;
    
    const plots = await Plot.find(plotQuery).lean();
    
    if (plots.length === 0) {
      const error = new Error('No plots found');
      error.statusCode = 404;
      throw error;
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=aquametic-weekly-report-${endDate.toISOString().split('T')[0]}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add Header
    doc.fontSize(20).font('Helvetica-Bold').text('Aquametic Smart Irrigation', { align: 'center' });
    doc.fontSize(16).text('Weekly Performance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Report Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary Section
    doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Total Plots: ${plots.length}`);
    
    let totalReadings = 0;
    let totalRecommendations = 0;

    // Loop through each plot
    for (const plot of plots) {
      doc.moveDown(1.5);
      doc.fontSize(12).font('Helvetica-Bold').text(`Plot: ${plot.name}`, { underline: true });
      doc.moveDown(0.5);

      // Plot details
      doc.fontSize(10).font('Helvetica');
      if (plot.location) doc.text(`Location: ${plot.location}`);
      if (plot.crop_type) doc.text(`Crop: ${plot.crop_type}`);
      if (plot.sensor_id) doc.text(`Sensor ID: ${plot.sensor_id}`);
      doc.text(`Current Moisture: ${plot.current_moisture ? plot.current_moisture + '%' : 'N/A'}`);
      doc.moveDown(0.5);

      // Get sensor data for this plot
      if (plot.sensor_id) {
        const sensorData = await SensorData.find({
          sensor_id: plot.sensor_id,
          timestamp: { $gte: startDate, $lte: endDate }
        }).sort({ timestamp: 1 }).lean();

        totalReadings += sensorData.length;

        doc.fontSize(11).font('Helvetica-Bold').text('Sensor Data Statistics:');
        doc.fontSize(10).font('Helvetica');
        doc.text(`  • Total Readings: ${sensorData.length}`);

        if (sensorData.length > 0) {
          const moistureValues = sensorData.map(d => d.moisture_value).filter(v => v !== null);
          
          if (moistureValues.length > 0) {
            const avgMoisture = (moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length).toFixed(1);
            const minMoisture = Math.min(...moistureValues).toFixed(1);
            const maxMoisture = Math.max(...moistureValues).toFixed(1);

            doc.text(`  • Average Moisture: ${avgMoisture}%`);
            doc.text(`  • Min Moisture: ${minMoisture}%`);
            doc.text(`  • Max Moisture: ${maxMoisture}%`);

            // Moisture status
            if (avgMoisture < 30) {
              doc.text(`  • Status: ⚠️ Low moisture - irrigation needed`, { continued: false });
            } else if (avgMoisture >= 30 && avgMoisture < 70) {
              doc.text(`  • Status: ✓ Optimal moisture range`);
            } else {
              doc.text(`  • Status: ⚠️ High moisture - risk of overwatering`);
            }
          }
        } else {
          doc.text(`  • No sensor data recorded this week`);
        }
      } else {
        doc.text('  • No sensor configured for this plot');
      }

      doc.moveDown(0.5);

      // Get recommendations for this plot
      const recommendations = await Recommendation.find({
        plot_id: plot._id,
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean();

      totalRecommendations += recommendations.length;

      doc.fontSize(11).font('Helvetica-Bold').text('Irrigation Recommendations:');
      doc.fontSize(10).font('Helvetica');
      doc.text(`  • Total Recommendations: ${recommendations.length}`);
      
      if (recommendations.length > 0) {
        const accepted = recommendations.filter(r => r.status === 'accepted').length;
        const rejected = recommendations.filter(r => r.status === 'rejected').length;
        const pending = recommendations.filter(r => r.status === 'pending').length;
        
        doc.text(`  • Accepted: ${accepted}`);
        doc.text(`  • Rejected: ${rejected}`);
        doc.text(`  • Pending: ${pending}`);

        // Calculate compliance rate
        const complianceRate = recommendations.length > 0 
          ? Math.round((accepted / recommendations.length) * 100) 
          : 0;
        doc.text(`  • Compliance Rate: ${complianceRate}%`);

        // Cost savings from avoided irrigation
        const COST_PER_HOUR_SAVED = 20; // RM (fuel + electricity + labor)
        let estimatedWater = 0;
        let actualWater = 0;
        recommendations.forEach(r => {
          if (r.status === 'accepted' && r.estimated_water_ml) {
            estimatedWater += r.estimated_water_ml;
            if (r.actual_water_ml) {
              actualWater += r.actual_water_ml;
            }
          }
        });
        
        if (estimatedWater > 0) {
          const waterVolumeSaved = estimatedWater - actualWater;
          const costSaved = acceptedCount * COST_PER_HOUR_SAVED;
          doc.text(`  • Estimated Water Usage: ${(estimatedWater / 1000).toFixed(1)}L`);
          if (actualWater > 0) {
            doc.text(`  • Actual Water Usage: ${(actualWater / 1000).toFixed(1)}L`);
            doc.text(`  • Water Volume Saved: ${(waterVolumeSaved / 1000).toFixed(1)}L`);
            doc.text(`  • Operational Cost Saved: RM ${costSaved.toFixed(2)}`);
          }
        }
      } else {
        doc.text(`  • No recommendations issued this week`);
      }

      // Add page break if not last plot
      if (plots.indexOf(plot) < plots.length - 1) {
        doc.addPage();
      }
    }

    // Overall Summary
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Overall Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`• Total Plots Monitored: ${plots.length}`);
    doc.text(`• Total Sensor Readings: ${totalReadings}`);
    doc.text(`• Total Recommendations Issued: ${totalRecommendations}`);
    doc.moveDown(1);

    // Footer
    doc.fontSize(8).text('Generated by Aquametic Smart Irrigation System', { align: 'center' });
    doc.text('For more details, please visit your dashboard', { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/report/csv - Generate CSV export
exports.exportDataCSV = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { plotId, startDate, endDate, type = 'sensor' } = req.query;

    // Calculate date range (default last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    let csvData = '';
    let filename = '';

    if (type === 'sensor') {
      // Export sensor data
      const query = {
        timestamp: { $gte: start, $lte: end }
      };

      if (plotId) {
        const plot = await Plot.findOne({ _id: plotId, farmer_id: userId });
        if (!plot) {
          const error = new Error('Plot not found');
          error.statusCode = 404;
          throw error;
        }
        const sensorIds = plot.sensor_ids && plot.sensor_ids.length > 0 ? plot.sensor_ids : [plot.sensor_id];
        query.sensor_id = { $in: sensorIds };
      } else {
        // Get all user's plots
        const plots = await Plot.find({ farmer_id: userId });
        const allSensorIds = plots.flatMap(p => 
          p.sensor_ids && p.sensor_ids.length > 0 ? p.sensor_ids : [p.sensor_id]
        ).filter(id => id);
        query.sensor_id = { $in: allSensorIds };
      }

      const sensorData = await SensorData.find(query).sort({ timestamp: -1 }).lean();

      // CSV Headers
      csvData = 'Timestamp,Sensor ID,Plot ID,Moisture (%),Temperature (°C),Humidity (%),Source\n';

      // CSV Rows
      for (const data of sensorData) {
        const row = [
          new Date(data.timestamp).toISOString(),
          data.sensor_id || 'N/A',
          data.plot_id || 'N/A',
          data.moisture_value !== null ? data.moisture_value : 'N/A',
          data.temperature !== null ? data.temperature : 'N/A',
          data.humidity !== null ? data.humidity : 'N/A',
          data.source || 'sensor'
        ];
        csvData += row.join(',') + '\n';
      }

      filename = `sensor-data-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

    } else if (type === 'recommendations') {
      // Export recommendations
      const query = {
        farmer_id: userId,
        createdAt: { $gte: start, $lte: end }
      };

      if (plotId) {
        query.plot_id = plotId;
      }

      const recommendations = await Recommendation.find(query)
        .populate('plot_id', 'name location crop_type')
        .sort({ createdAt: -1 })
        .lean();

      // CSV Headers
      csvData = 'Date,Plot Name,Crop Type,Moisture (%),Water Amount (L),Duration (min),Status,Response\n';

      // CSV Rows
      for (const rec of recommendations) {
        const row = [
          new Date(rec.createdAt).toISOString(),
          rec.plot_id?.name || 'N/A',
          rec.plot_id?.crop_type || 'N/A',
          rec.current_moisture !== null ? rec.current_moisture : 'N/A',
          rec.water_amount || 'N/A',
          rec.watering_duration || 'N/A',
          rec.status || 'pending',
          rec.farmer_response || 'no response'
        ];
        csvData += row.map(field => `"${field}"`).join(',') + '\n';
      }

      filename = `recommendations-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

    } else if (type === 'plots') {
      // Export plots summary
      const plots = await Plot.find({ farmer_id: userId }).lean();

      // CSV Headers
      csvData = 'Plot Name,Location,Crop Type,Size (acres),Sensors,Current Moisture (%),Status,Created Date\n';

      // CSV Rows
      for (const plot of plots) {
        const row = [
          plot.name || 'N/A',
          plot.location || 'N/A',
          plot.crop_type || 'N/A',
          plot.size_acres || 'N/A',
          plot.number_of_sensors || 1,
          plot.current_moisture !== null ? plot.current_moisture : 'N/A',
          plot.status || 'active',
          new Date(plot.createdAt).toISOString().split('T')[0]
        ];
        csvData += row.map(field => `"${field}"`).join(',') + '\n';
      }

      filename = `plots-summary-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      const error = new Error('Invalid export type. Use: sensor, recommendations, or plots');
      error.statusCode = 400;
      throw error;
    }

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvData);

  } catch (error) {
    next(error);
  }
};
