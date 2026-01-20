const SensorData = require('../models/SensorData');
const Plot = require('../models/Plot');
const mongoose = require('mongoose');

// GET /api/analytics/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 1. Get total plots count
    const plotsCount = await Plot.countDocuments({ farmer_id: userId });
    
    // 2. Get plots IDs
    const userPlots = await Plot.find({ farmer_id: userId }).select('sensor_id');
    const sensorIds = userPlots.map(p => p.sensor_id).filter(id => id);

    // 3. Get total readings count for these sensors
    const readingsCount = await SensorData.countDocuments({ 
      sensor_id: { $in: sensorIds } 
    });
    
    // 4. Calculate average moisture across all user's plots (Latest reading only)
    let totalCurrentMoisture = 0;
    let activeSensors = 0;
    
    for (const sensorId of sensorIds) {
      const latest = await SensorData.findOne({ sensor_id: sensorId }).sort({ timestamp: -1 });
      if (latest) {
        totalCurrentMoisture += latest.moisture_value;
        activeSensors++;
      }
    }
    
    const avgMoisture = activeSensors > 0 ? (totalCurrentMoisture / activeSensors).toFixed(1) : 0;

    res.json({
        success: true,
        stats: {
            plots: plotsCount,
            totalReadings: readingsCount,
            averageFarmMoisture: avgMoisture,
            activeSensors: activeSensors
        }
    });

  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/trends
// COMPLEXITY: Uses MongoDB Aggregation Pipeline
exports.getMoistureTrends = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query; // Default to last 7 days

    // Get user's sensor IDs
    const userPlots = await Plot.find({ farmer_id: userId }).select('sensor_id');
    const sensorIds = userPlots.map(p => p.sensor_id).filter(id => id);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Aggregate daily averages
    const trends = await SensorData.aggregate([
      {
        $match: {
          sensor_id: { $in: sensorIds },
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } 
          },
          avgMoisture: { $avg: "$moisture_value" },
          readingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } } // Sort by date ascending
    ]);

    res.json({
      success: true,
      trends
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/cost-savings
// COMPLEXITY: Operational Cost Savings Calculation (Fuel, Electricity, Labor)
exports.getCostSavings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      days = 30,
      pumpType = 'diesel', // 'diesel', 'electric', or 'both'
      dieselCostPerLiter = 2.05, // RM per liter
      electricityCostPerKwh = 0.571, // RM per kWh
      pumpPowerKw = 3, // Pump motor power rating in kW
      laborCostPerHour = 15, // RM per hour
      pumpEfficiency = 0.75 // Pump efficiency factor (75%)
    } = req.query;

    // Configuration (based on agricultural research standards)
    // Traditional irrigation: Assumes scheduled watering regardless of need
    const TRADITIONAL_FREQUENCY_PER_WEEK = 3; // 3 times per week
    const TRADITIONAL_DURATION_HOURS = 2; // 2 hours per session
    
    // Crop-specific water requirements (liters per hour per hectare)
    // Based on agricultural research: water depth needed × area
    const CROP_WATER_RATES = {
      'rice': 400000,      // Rice paddies need 150-200mm depth = ~400m³/hour/hectare (highest)
      'wheat': 200000,     // Wheat needs moderate water = ~200m³/hour/hectare
      'corn': 250000,      // Corn/Maize needs ~250m³/hour/hectare
      'vegetable': 180000, // Vegetables need less = ~180m³/hour/hectare
      'sugarcane': 350000, // Sugarcane needs high water = ~350m³/hour/hectare
      'cotton': 220000,    // Cotton moderate = ~220m³/hour/hectare
      'soybean': 200000,   // Soybean moderate = ~200m³/hour/hectare
      'default': 250000    // Default for unspecified crops = ~250m³/hour/hectare
    };
    
    // Energy consumption constants
    // Diesel pump typically consumes 0.25-0.35 liters per hour per kW
    const DIESEL_CONSUMPTION_PER_KW_PER_HOUR = 0.3; // liters
    // Electric pump uses rated power directly
    // Water pumping CO2 footprint (pumping energy)
    const CO2_PER_KWH = 0.694; // kg CO2 per kWh (Malaysia grid average)
    const CO2_PER_LITER_DIESEL = 2.68; // kg CO2 per liter of diesel
    
    const CRITICAL_MOISTURE_THRESHOLD = 20; // Below this = urgent irrigation needed
    const OPTIMAL_MOISTURE_MIN = 40;
    const OPTIMAL_MOISTURE_MAX = 70;
    
    // Smart system: Only irrigates when moisture drops, then brings back to optimal
    const SMART_IRRIGATION_DURATION_HOURS = 1.5; // Shorter sessions, targeted watering
    
    // Conversion factor
    const ACRES_TO_HECTARES = 0.404686; // 1 acre = 0.404686 hectares

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get user's plots and sensor IDs
    const userPlots = await Plot.find({ farmer_id: userId })
      .select('name sensor_id')
      .lean();
    
    if (userPlots.length === 0) {
      return res.json({
        success: true,
        message: 'No plots found',
        data: {
          period: `last_${days}_days`,
          totalPumpHoursSaved: 0,
          totalCostSaved: 0,
          totalFuelSaved: 0,
          totalElectricitySaved: 0,
          totalLaborHoursSaved: 0,
          percentageSaved: 0,
          co2Saved: 0,
          plots: []
        }
      });
    }

    const sensorIds = userPlots.map(p => p.sensor_id).filter(id => id);

    // Get full plot details including size and crop type
    const plotsWithSize = await Plot.find({ farmer_id: userId })
      .select('name sensor_id size_acres crop_type')
      .lean();

    const plotResults = [];
    let totalTraditionalPumpHours = 0;
    let totalSmartPumpHours = 0;
    let totalTraditionalUse = 0;
    let totalSmartUse = 0;

    // Analyze each plot
    for (const plot of plotsWithSize) {
      if (!plot.sensor_id) continue;

      // Get plot size in acres and convert to hectares for calculation
      const plotSizeAcres = plot.size_acres || 2.5; // Default 2.5 acres
      const plotSizeHectares = plotSizeAcres * ACRES_TO_HECTARES; // Convert to hectares
      
      // Get crop-specific water rate (match case-insensitive)
      const cropType = (plot.crop_type || 'default').toLowerCase();
      let waterRatePerHectarePerHour = CROP_WATER_RATES.default;
      
      // Check for matching crop type
      for (const [crop, rate] of Object.entries(CROP_WATER_RATES)) {
        if (cropType.includes(crop)) {
          waterRatePerHectarePerHour = rate;
          break;
        }
      }
      
      /* TRADITIONAL IRRIGATION CALCULATION:
       * Formula: Frequency × Duration × Water_Rate × Plot_Size × Time_Period
       * 
       * Example for 5-acre (2.02 hectare) rice field over 30 days:
       * - Traditional: 3 times/week × 2 hours × 400,000 L/hr/ha × 2.02 ha × 4.3 weeks
       *   = 3 × 2 × 400,000 × 2.02 × 4.3 = 20.8 MILLION liters
       * 
       * This represents scheduled irrigation regardless of soil moisture
       */
      const weeksInPeriod = parseInt(days) / 7;
      const traditionalPumpHours = 
        TRADITIONAL_FREQUENCY_PER_WEEK * 
        TRADITIONAL_DURATION_HOURS * 
        weeksInPeriod;
      
      const traditionalWaterPerPlot = 
        traditionalPumpHours * 
        waterRatePerHectarePerHour * 
        plotSizeHectares;

      // Get sensor data for this plot
      const sensorData = await SensorData.find({
        sensor_id: plot.sensor_id,
        timestamp: { $gte: startDate }
      }).sort({ timestamp: 1 }).lean();

      if (sensorData.length === 0) {
        // No sensor data - calculate theoretical savings
        const pumpHoursSaved = traditionalPumpHours;
        const waterVolumeSaved = traditionalWaterPerPlot;
        
        // Calculate costs based on pump type
        let fuelSaved = 0;
        let electricitySaved = 0;
        let fuelCost = 0;
        let electricityCost = 0;
        
        if (pumpType === 'diesel' || pumpType === 'both') {
          fuelSaved = pumpHoursSaved * parseFloat(pumpPowerKw) * DIESEL_CONSUMPTION_PER_KW_PER_HOUR;
          fuelCost = fuelSaved * parseFloat(dieselCostPerLiter);
        }
        if (pumpType === 'electric' || pumpType === 'both') {
          electricitySaved = pumpHoursSaved * parseFloat(pumpPowerKw);
          electricityCost = electricitySaved * parseFloat(electricityCostPerKwh);
        }
        
        const laborCost = pumpHoursSaved * parseFloat(laborCostPerHour);
        const maintenanceCost = (fuelCost + electricityCost) * 0.1; // 10% of energy costs
        const totalCostSaved = fuelCost + electricityCost + laborCost + maintenanceCost;
        
        plotResults.push({
          plotId: plot._id,
          plotName: plot.name,
          sensorId: plot.sensor_id,
          sizeAcres: plotSizeAcres,
          sizeHectares: plotSizeHectares,
          cropType: plot.crop_type || 'Not specified',
          waterRateUsed: waterRatePerHectarePerHour,
          traditionalPumpHours: Math.round(traditionalPumpHours * 10) / 10,
          smartPumpHours: 0,
          pumpHoursSaved: Math.round(pumpHoursSaved * 10) / 10,
          traditionalWaterUse: Math.round(traditionalWaterPerPlot),
          smartWaterUse: 0,
          waterVolumeSaved: Math.round(waterVolumeSaved),
          fuelSaved: Math.round(fuelSaved * 10) / 10,
          electricitySaved: Math.round(electricitySaved * 10) / 10,
          laborHoursSaved: Math.round(pumpHoursSaved * 10) / 10,
          costBreakdown: {
            fuelCost: fuelCost.toFixed(2),
            electricityCost: electricityCost.toFixed(2),
            laborCost: laborCost.toFixed(2),
            maintenanceCost: maintenanceCost.toFixed(2)
          },
          totalCostSaved: totalCostSaved.toFixed(2),
          irrigationEvents: 0,
          efficiencyIndex: 0,
          percentageSaved: 100
        });
        totalTraditionalPumpHours += traditionalPumpHours;
        totalTraditionalUse += traditionalWaterPerPlot;
        continue;
      }

      // Smart irrigation: Count distinct irrigation events (not every reading!)
      // Group readings by day, then check if ANY reading that day was below threshold
      const dailyData = {};
      for (const reading of sensorData) {
        const date = reading.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
        if (!dailyData[date]) {
          dailyData[date] = { readings: [], minMoisture: 100 };
        }
        dailyData[date].readings.push(reading.moisture_value);
        dailyData[date].minMoisture = Math.min(dailyData[date].minMoisture, reading.moisture_value);
      }

      // Count irrigation events: Only 1 event per day if ANY reading was critical
      let irrigationEvents = 0;
      let daysInOptimalRange = 0;
      
      for (const date in dailyData) {
        const dayData = dailyData[date];
        
        // If the day's minimum moisture was critical, count as 1 irrigation event
        if (dayData.minMoisture < CRITICAL_MOISTURE_THRESHOLD) {
          irrigationEvents++;
        }
        
        // If average moisture for the day was optimal, count it
        const avgMoisture = dayData.readings.reduce((a, b) => a + b, 0) / dayData.readings.length;
        if (avgMoisture >= OPTIMAL_MOISTURE_MIN && avgMoisture <= OPTIMAL_MOISTURE_MAX) {
          daysInOptimalRange++;
        }
      }

      /* SMART IRRIGATION CALCULATION:
       * Formula: Irrigation_Events × Duration × Water_Rate × Plot_Size
       * 
       * Example for same 5-acre rice field with 5 critical moisture events:
       * - Smart: 5 events × 1.5 hours × 400,000 L/hr/ha × 2.02 ha
       *   = 5 × 1.5 × 400,000 × 2.02 = 6.06 MILLION liters
       * 
       * COST SAVINGS = (Traditional Pump Hours - Smart Pump Hours) × Operational Costs
       *   Traditional: 25.7 hours, Smart: 7.5 hours = 18.2 hours saved (71% reduction)
       * 
       * Smart system only irrigates when soil moisture drops below 20%,
       * resulting in fewer but more targeted irrigation events and less pump operation.
       */
      const smartPumpHours = irrigationEvents * SMART_IRRIGATION_DURATION_HOURS;
      const smartWaterUse = smartPumpHours * waterRatePerHectarePerHour * plotSizeHectares;

      const pumpHoursSaved = traditionalPumpHours - smartPumpHours;
      const waterVolumeSaved = traditionalWaterPerPlot - smartWaterUse;
      
      // Calculate costs based on pump type
      let fuelSaved = 0;
      let electricitySaved = 0;
      let fuelCost = 0;
      let electricityCost = 0;
      
      if (pumpType === 'diesel' || pumpType === 'both') {
        fuelSaved = pumpHoursSaved * parseFloat(pumpPowerKw) * DIESEL_CONSUMPTION_PER_KW_PER_HOUR;
        fuelCost = fuelSaved * parseFloat(dieselCostPerLiter);
      }
      if (pumpType === 'electric' || pumpType === 'both') {
        electricitySaved = pumpHoursSaved * parseFloat(pumpPowerKw);
        electricityCost = electricitySaved * parseFloat(electricityCostPerKwh);
      }
      
      const laborCost = pumpHoursSaved * parseFloat(laborCostPerHour);
      const maintenanceCost = (fuelCost + electricityCost) * 0.1; // 10% of energy costs
      const totalCostSaved = fuelCost + electricityCost + laborCost + maintenanceCost;
      
      const totalDays = Object.keys(dailyData).length;
      const efficiencyIndex = totalDays > 0
        ? Math.round((daysInOptimalRange / totalDays) * 100) 
        : 0;
      const percentageSaved = traditionalPumpHours > 0
        ? Math.round((pumpHoursSaved / traditionalPumpHours) * 100)
        : 0;

      plotResults.push({
        plotId: plot._id,
        plotName: plot.name,
        sensorId: plot.sensor_id,
        sizeAcres: plotSizeAcres,
        sizeHectares: plotSizeHectares.toFixed(2),
        cropType: plot.crop_type || 'Not specified',
        waterRateUsed: waterRatePerHectarePerHour,
        traditionalPumpHours: Math.round(traditionalPumpHours * 10) / 10,
        smartPumpHours: Math.round(smartPumpHours * 10) / 10,
        pumpHoursSaved: Math.round(pumpHoursSaved * 10) / 10,
        traditionalWaterUse: Math.round(traditionalWaterPerPlot),
        smartWaterUse: Math.round(smartWaterUse),
        waterVolumeSaved: Math.round(waterVolumeSaved),
        fuelSaved: Math.round(fuelSaved * 10) / 10,
        electricitySaved: Math.round(electricitySaved * 10) / 10,
        laborHoursSaved: Math.round(pumpHoursSaved * 10) / 10,
        costBreakdown: {
          fuelCost: fuelCost.toFixed(2),
          electricityCost: electricityCost.toFixed(2),
          laborCost: laborCost.toFixed(2),
          maintenanceCost: maintenanceCost.toFixed(2)
        },
        totalCostSaved: totalCostSaved.toFixed(2),
        irrigationEvents: irrigationEvents,
        efficiencyIndex: efficiencyIndex,
        percentageSaved: percentageSaved,
        readingsCount: sensorData.length,
        daysMonitored: totalDays
      });

      totalTraditionalPumpHours += traditionalPumpHours;
      totalSmartPumpHours += smartPumpHours;
      totalTraditionalUse += traditionalWaterPerPlot;
      totalSmartUse += smartWaterUse;
    }

    // Calculate totals
    const totalPumpHoursSaved = totalTraditionalPumpHours - totalSmartPumpHours;
    const totalWaterVolumeSaved = totalTraditionalUse - totalSmartUse;
    
    // Calculate total costs based on pump type
    let totalFuelSaved = 0;
    let totalElectricitySaved = 0;
    let totalFuelCost = 0;
    let totalElectricityCost = 0;
    
    if (pumpType === 'diesel' || pumpType === 'both') {
      totalFuelSaved = totalPumpHoursSaved * parseFloat(pumpPowerKw) * DIESEL_CONSUMPTION_PER_KW_PER_HOUR;
      totalFuelCost = totalFuelSaved * parseFloat(dieselCostPerLiter);
    }
    if (pumpType === 'electric' || pumpType === 'both') {
      totalElectricitySaved = totalPumpHoursSaved * parseFloat(pumpPowerKw);
      totalElectricityCost = totalElectricitySaved * parseFloat(electricityCostPerKwh);
    }
    
    const totalLaborCost = totalPumpHoursSaved * parseFloat(laborCostPerHour);
    const totalMaintenanceCost = (totalFuelCost + totalElectricityCost) * 0.1;
    const totalCostSaved = totalFuelCost + totalElectricityCost + totalLaborCost + totalMaintenanceCost;
    
    // Calculate CO2 savings
    let co2Saved = 0;
    if (pumpType === 'diesel' || pumpType === 'both') {
      co2Saved += totalFuelSaved * CO2_PER_LITER_DIESEL;
    }
    if (pumpType === 'electric' || pumpType === 'both') {
      co2Saved += totalElectricitySaved * CO2_PER_KWH;
    }
    
    const percentageSaved = totalTraditionalPumpHours > 0
      ? Math.round((totalPumpHoursSaved / totalTraditionalPumpHours) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        period: `last_${days}_days`,
        daysAnalyzed: parseInt(days),
        pumpType: pumpType,
        totalTraditionalPumpHours: Math.round(totalTraditionalPumpHours * 10) / 10,
        totalSmartPumpHours: Math.round(totalSmartPumpHours * 10) / 10,
        totalPumpHoursSaved: Math.round(totalPumpHoursSaved * 10) / 10,
        totalTraditionalWaterUse: Math.round(totalTraditionalUse),
        totalSmartWaterUse: Math.round(totalSmartUse),
        totalWaterVolumeSaved: Math.round(totalWaterVolumeSaved),
        totalFuelSaved: Math.round(totalFuelSaved * 10) / 10,
        totalElectricitySaved: Math.round(totalElectricitySaved * 10) / 10,
        totalLaborHoursSaved: Math.round(totalPumpHoursSaved * 10) / 10,
        costBreakdown: {
          fuelCost: totalFuelCost.toFixed(2),
          electricityCost: totalElectricityCost.toFixed(2),
          laborCost: totalLaborCost.toFixed(2),
          maintenanceCost: totalMaintenanceCost.toFixed(2)
        },
        totalCostSaved: totalCostSaved.toFixed(2),
        percentageSaved: percentageSaved,
        co2Saved: co2Saved.toFixed(3),
        currency: 'RM',
        plots: plotResults.sort((a, b) => parseFloat(b.totalCostSaved) - parseFloat(a.totalCostSaved)), // Sort by cost savings
        configuration: {
          traditionalFrequency: `${TRADITIONAL_FREQUENCY_PER_WEEK}x per week`,
          traditionalDuration: `${TRADITIONAL_DURATION_HOURS} hours per session`,
          smartDuration: `${SMART_IRRIGATION_DURATION_HOURS} hours per session`,
          waterRatePerHectare: 'Crop-specific (180k-400k L/hour/hectare)',
          pumpPowerKw: `${pumpPowerKw} kW`,
          dieselConsumption: `${DIESEL_CONSUMPTION_PER_KW_PER_HOUR} L/kW/hour`,
          criticalThreshold: `${CRITICAL_MOISTURE_THRESHOLD}%`,
          optimalRange: `${OPTIMAL_MOISTURE_MIN}-${OPTIMAL_MOISTURE_MAX}%`,
          costs: {
            dieselPerLiter: `RM ${dieselCostPerLiter}`,
            electricityPerKwh: `RM ${electricityCostPerKwh}`,
            laborPerHour: `RM ${laborCostPerHour}`
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
// Backward compatibility alias for old endpoint
exports.getWaterConservation = exports.getCostSavings;