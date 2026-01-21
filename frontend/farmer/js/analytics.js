import { API_BASE_URL } from '../../shared/js/api.js';
import { getCurrentUser, getToken } from '../../shared/js/auth.js';

// Authentication check
const user = getCurrentUser();
const token = getToken();

if (!user || !token) {
    window.location.href = '../auth/index.html';
}

// Display username
document.getElementById('username-display').innerHTML = `<i class="fas fa-user-circle"></i> ${user.username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('username');
    window.location.href = '../auth/index.html';
});

// Chart instances
let moistureTrendChart = null;
let wateringFrequencyChart = null;
let conservationUsageChart = null;
let conservationPlotChart = null;

// Available plots
let availablePlots = [];
let selectedPlotSensorId = null;

// Cost parameters (fetched from backend)
let costParameters = {
    dieselCostPerLiter: 2.05,
    electricityCostPerKwh: 0.571,
    pumpPowerKw: 3,
    laborCostPerHour: 15
};

// Moisture thresholds (fetched from backend based on crop type)
let moistureThresholds = {
    critical: 20,
    low: 30,
    optimal_min: 40,
    optimal_max: 70,
    high: 80
};

/**
 * Fetches cost parameters from backend
 */
async function fetchCostParameters() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings/cost-parameters`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            costParameters = data.data;
            console.log('Cost parameters loaded:', costParameters);
        }
    } catch (error) {
        console.error('Error fetching cost parameters, using defaults:', error);
    }
}

/**
 * Fetches moisture thresholds for specific crop type
 */
async function fetchMoistureThresholds(cropType) {
    try {
        const response = await fetch(`${API_BASE_URL}/settings/moisture-thresholds/${encodeURIComponent(cropType)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            moistureThresholds = data.data.thresholds;
            console.log(`Moisture thresholds for ${cropType}:`, moistureThresholds);
        }
    } catch (error) {
        console.error('Error fetching moisture thresholds, using defaults:', error);
    }
}

/**
 * Fetches all plots for the user
 */
async function fetchPlots() {
    try {
        const response = await fetch(`${API_BASE_URL}/plots`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch plots');
        }

        const data = await response.json();
        availablePlots = data.plots || [];
        
        // Populate dropdown
        populatePlotSelector();
        
        // Fetch cost parameters from backend
        await fetchCostParameters();
        
        // Select first plot by default
        if (availablePlots.length > 0) {
            selectedPlotSensorId = availablePlots[0].sensor_id;
            document.getElementById('plotSelector').value = selectedPlotSensorId;
            
            // Fetch thresholds for this plot's crop type
            const selectedPlot = availablePlots[0];
            if (selectedPlot.crop_type) {
                await fetchMoistureThresholds(selectedPlot.crop_type);
            }
            
            loadAnalyticsData();
            if (window.toast) {
                window.toast.success('Analytics data loaded', 2000);
            }
        } else {
            document.getElementById('plotSelector').innerHTML = '<option value="">No plots available</option>';
            if (window.toast) {
                window.toast.info('No plots available. Please add plots first.');
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'No Plots Found',
                    text: 'Please add plots to view analytics',
                    confirmButtonColor: '#2E7D32'
                });
            }
        }
    } catch (error) {
        console.error('Error fetching plots:', error);
        if (window.toast) {
            window.toast.error('Failed to load analytics data');
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load plots',
                confirmButtonColor: '#2E7D32'
            });
        }
    }
}

/**
 * Populates the plot selector dropdown
 */
function populatePlotSelector() {
    const selector = document.getElementById('plotSelector');
    
    if (availablePlots.length === 0) {
        selector.innerHTML = '<option value="">No plots available</option>';
        return;
    }
    
    selector.innerHTML = availablePlots.map(plot => 
        `<option value="${plot.sensor_id}">${plot.name} (${plot.sensor_id})</option>`
    ).join('');
}

// Plot selector change event
document.getElementById('plotSelector').addEventListener('change', async (e) => {
    selectedPlotSensorId = e.target.value;
    if (selectedPlotSensorId) {
        // Find the selected plot and update thresholds based on crop type
        const selectedPlot = availablePlots.find(p => p.sensor_id === selectedPlotSensorId);
        if (selectedPlot && selectedPlot.crop_type) {
            await fetchMoistureThresholds(selectedPlot.crop_type);
        }
        loadAnalyticsData();
    }
});

/**
 * Gets the day name from a date
 * @param {Date} date - Date object
 * @returns {string} - Day name (Mon, Tue, Wed, etc.)
 */
function getDayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
}

/**
 * Groups sensor data by day and calculates average moisture
 * @param {Array} sensorLogs - Array of sensor log objects
 * @returns {Object} - Object with days as keys and average moisture values
 */
function groupDataByDay(sensorLogs) {
    const grouped = {};
    
    sensorLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dayName = getDayName(date);
        
        if (!grouped[dayName]) {
            grouped[dayName] = {
                values: [],
                count: 0,
                criticalEvents: 0
            };
        }
        
        const moisture = log.moisture_value !== undefined ? log.moisture_value : (log.moistureValue || 0);
        grouped[dayName].values.push(moisture);
        grouped[dayName].count++;
        
        // Count critical events using dynamic threshold
        if (moisture < moistureThresholds.critical) {
            grouped[dayName].criticalEvents++;
        }
    });
    
    // Calculate averages
    const result = {};
    for (const day in grouped) {
        const sum = grouped[day].values.reduce((acc, val) => acc + val, 0);
        result[day] = {
            average: (sum / grouped[day].count).toFixed(1),
            criticalEvents: grouped[day].criticalEvents,
            count: grouped[day].count
        };
    }
    
    return result;
}

/**
 * Gets last 7 days in order
 * @returns {Array} - Array of day names in chronological order
 */
function getLast7Days() {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(getDayName(date));
    }
    
    return days;
}

/**
 * Fetches sensor logs and renders charts (filtered by selected plot)
 */
async function loadAnalyticsData() {
    try {
        if (!selectedPlotSensorId) {
            console.log('No plot selected yet');
            return;
        }
        
        // BACKEND FILTERING: Pass sensorId as query parameter for efficient filtering
        const response = await fetch(`${API_BASE_URL}/sensor/logs?sensorId=${selectedPlotSensorId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const sensorLogs = data.logs || [];
        
        // Data is already filtered by backend, no client-side filtering needed
        // Update total readings count for this plot
        document.getElementById('total-readings').textContent = sensorLogs.length;
        
        // Group data by day
        const groupedData = groupDataByDay(sensorLogs);
        
        // Get last 7 days in order
        const last7Days = getLast7Days();
        
        // Prepare chart data
        const averageMoistureData = last7Days.map(day => groupedData[day]?.average || 0);
        const criticalEventsData = last7Days.map(day => groupedData[day]?.criticalEvents || 0);
        
        // Calculate overall statistics
        calculateStatistics(sensorLogs, criticalEventsData);
        
        // Render charts
        renderMoistureTrendChart(last7Days, averageMoistureData);
        renderWateringFrequencyChart(last7Days, criticalEventsData);
        
    } catch (error) {
        console.error('Error loading analytics data:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load analytics data',
            confirmButtonColor: '#2E7D32'
        });
    }
}

/**
 * Calculates and displays overall statistics
 * @param {Array} sensorLogs - Array of sensor logs
 * @param {Array} criticalEventsData - Array of critical events per day
 */
function calculateStatistics(sensorLogs, criticalEventsData) {
    if (sensorLogs.length === 0) {
        document.getElementById('avg-moisture-badge').textContent = 'No Data';
        document.getElementById('avg-moisture-badge').className = 'badge bg-secondary';
        document.getElementById('critical-events-badge').textContent = '0';
        document.getElementById('highest-moisture').textContent = '--';
        document.getElementById('lowest-moisture').textContent = '--';
        return;
    }
    
    // Calculate average moisture
    const moistureValues = sensorLogs.map(log => 
        log.moisture_value !== undefined ? log.moisture_value : (log.moistureValue || 0)
    );
    const avgMoisture = (moistureValues.reduce((acc, val) => acc + val, 0) / moistureValues.length).toFixed(1);
    
    // Calculate highest and lowest
    const highestMoisture = Math.max(...moistureValues).toFixed(1);
    const lowestMoisture = Math.min(...moistureValues).toFixed(1);
    
    // Calculate total critical events
    const totalCriticalEvents = criticalEventsData.reduce((acc, val) => acc + val, 0);
    
    // Update UI
    document.getElementById('avg-moisture-badge').textContent = `${avgMoisture}%`;
    
    // Color code based on crop-specific moisture thresholds
    const badge = document.getElementById('avg-moisture-badge');
    if (avgMoisture >= moistureThresholds.optimal_min) {
        badge.className = 'badge bg-success';
    } else if (avgMoisture >= moistureThresholds.low) {
        badge.className = 'badge bg-warning';
    } else {
        badge.className = 'badge bg-danger';
    }
    
    document.getElementById('critical-events-badge').textContent = totalCriticalEvents;
    document.getElementById('highest-moisture').textContent = `${highestMoisture}%`;
    document.getElementById('lowest-moisture').textContent = `${lowestMoisture}%`;
}

/**
 * Renders the Weekly Moisture Trend Line Chart
 * @param {Array} labels - Day names
 * @param {Array} data - Average moisture values
 */
function renderMoistureTrendChart(labels, data) {
    const ctx = document.getElementById('moistureTrendChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (moistureTrendChart) {
        moistureTrendChart.destroy();
    }
    
    moistureTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Moisture (%)',
                data: data,
                borderColor: '#039BE5',
                backgroundColor: 'rgba(3, 155, 229, 0.2)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#2E7D32',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            },
            transitions: {
                active: {
                    animation: {
                        duration: 400
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        family: 'Poppins',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Poppins',
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            return `Avg Moisture: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        font: {
                            family: 'Poppins'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            family: 'Poppins',
                            size: 11
                        },
                        autoSkip: false,
                        padding: 10
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Enhance chart with animations
    if (window.ChartAnimations) {
        window.ChartAnimations.enhanceChart(moistureTrendChart);
    }
}

/**
 * Renders the Watering Frequency Bar Chart
 * @param {Array} labels - Day names
 * @param {Array} data - Critical events count per day
 */
function renderWateringFrequencyChart(labels, data) {
    const ctx = document.getElementById('wateringFrequencyChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (wateringFrequencyChart) {
        wateringFrequencyChart.destroy();
    }
    
    wateringFrequencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Critical Events (Moisture < ${moistureThresholds.critical}%)`,
                data: data,
                backgroundColor: 'rgba(220, 53, 69, 0.7)',
                borderColor: '#dc3545',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            },
            transitions: {
                active: {
                    animation: {
                        duration: 400
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        family: 'Poppins',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Poppins',
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            const count = context.parsed.y;
                            return `Critical Events: ${count}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            family: 'Poppins'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Poppins'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Enhance chart with animations
    if (window.ChartAnimations) {
        window.ChartAnimations.enhanceChart(wateringFrequencyChart);
    }
}

/**
 * Refresh charts button handler
 */
document.getElementById('refreshChartsBtn').addEventListener('click', async () => {
    const refreshBtn = document.getElementById('refreshChartsBtn');
    const originalHtml = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    refreshBtn.disabled = true;
    
    // Reload data
    await loadAnalyticsData();
    
    // Restore button
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
    
    // Show success toast
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Charts refreshed',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
});

// Initial load - fetch plots first, then load analytics for first plot
fetchPlots();

// ========================================
// COST SAVINGS ANALYTICS
// ========================================

/**
 * Load cost savings data
 */
async function loadWaterConservationData() {
    try {
        // Show loading state
        document.getElementById('conservationLoadingState').style.display = 'block';
        document.getElementById('conservationErrorState').style.display = 'none';
        document.getElementById('conservationDataDisplay').style.display = 'none';

        const period = document.getElementById('conservationPeriod').value;
        const pumpType = document.getElementById('conservationPumpType').value;

        const response = await fetch(
            `${API_BASE_URL}/analytics/cost-savings?days=${period}&pumpType=${pumpType}&dieselCostPerLiter=${costParameters.dieselCostPerLiter}&electricityCostPerKwh=${costParameters.electricityCostPerKwh}&pumpPowerKw=${costParameters.pumpPowerKw}&laborCostPerHour=${costParameters.laborCostPerHour}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch data');
        }

        const data = result.data;

        // Hide loading, show data
        document.getElementById('conservationLoadingState').style.display = 'none';
        document.getElementById('conservationDataDisplay').style.display = 'block';

        // Update summary cards
        updateConservationSummaryCards(data);

        // Update configuration display
        updateConservationConfigDisplay(data.configuration);

        // Render charts
        renderConservationUsageChart(data);
        renderConservationPlotChart(data.plots);

        // Update plot table
        updateConservationPlotTable(data.plots);

        console.log('Water Conservation Data:', data);

    } catch (error) {
        console.error('Error loading water conservation data:', error);
        document.getElementById('conservationLoadingState').style.display = 'none';
        document.getElementById('conservationErrorState').style.display = 'block';
        document.getElementById('conservationErrorMessage').textContent = `Error: ${error.message}`;
    }
}

/**
 * Update conservation summary cards
 */
function updateConservationSummaryCards(data) {
    document.getElementById('conservationTotalCostSaved').textContent = 
        `${data.currency}${parseFloat(data.totalCostSaved).toLocaleString()}`;
    
    document.getElementById('conservationPumpHoursSaved').textContent = 
        `${data.totalPumpHoursSaved.toFixed(1)}h`;
    
    document.getElementById('conservationPercentageSaved').textContent = 
        `${data.percentageSaved}%`;
    
    document.getElementById('conservationCO2Saved').textContent = 
        `${parseFloat(data.co2Saved).toFixed(2)} kg`;
}

/**
 * Update conservation configuration display
 */
function updateConservationConfigDisplay(config) {
    const configDisplay = document.getElementById('conservationConfigDisplay');
    configDisplay.innerHTML = `
        <span class="badge bg-primary">
            <i class="fas fa-calendar-alt"></i> ${config.traditionalFrequency}
        </span>
        <span class="badge bg-info">
            <i class="fas fa-clock"></i> Traditional: ${config.traditionalDuration}
        </span>
        <span class="badge bg-success">
            <i class="fas fa-clock"></i> Smart: ${config.smartDuration}
        </span>
        <span class="badge bg-secondary">
            <i class="fas fa-bolt"></i> ${config.pumpPowerKw}
        </span>
        <span class="badge bg-danger">
            <i class="fas fa-exclamation-triangle"></i> Critical: ${config.criticalThreshold}
        </span>
        <span class="badge bg-warning text-dark">
            <i class="fas fa-chart-line"></i> Optimal: ${config.optimalRange}
        </span>
        <div class="mt-2">
            <small><strong>Rates:</strong> ${config.costs.dieselPerLiter}/L, ${config.costs.electricityPerKwh}/kWh, ${config.costs.laborPerHour}/hour</small>
        </div>
    `;
}

/**
 * Render conservation usage comparison chart
 */
function renderConservationUsageChart(data) {
    const ctx = document.getElementById('conservationUsageChart').getContext('2d');
    
    // Destroy existing chart
    if (conservationUsageChart) {
        conservationUsageChart.destroy();
    }

    conservationUsageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Smart Pump Hours', 'Hours Saved'],
            datasets: [{
                data: [data.totalSmartPumpHours, data.totalPumpHoursSaved],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(67, 233, 123, 0.8)'
                ],
                borderColor: [
                    'rgba(102, 126, 234, 1)',
                    'rgba(67, 233, 123, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 14
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        family: 'Poppins',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Poppins',
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percentage = ((value / data.totalTraditionalPumpHours) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(1)} hours (${percentage}%)`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Traditional: ${data.totalTraditionalPumpHours.toFixed(1)} hours`,
                    font: {
                        family: 'Poppins',
                        size: 16
                    }
                }
            }
        }
    });
}

/**
 * Render per-plot savings bar chart
 */
function renderConservationPlotChart(plots) {
    const ctx = document.getElementById('conservationPlotChart').getContext('2d');
    
    // Destroy existing chart
    if (conservationPlotChart) {
        conservationPlotChart.destroy();
    }

    // Prepare data (top 10 plots)
    const topPlots = plots.slice(0, 10);
    const labels = topPlots.map(p => p.plotName);
    const costSaved = topPlots.map(p => parseFloat(p.totalCostSaved));
    
    // Color based on savings amount
    const colors = costSaved.map(value => {
        if (value > 100) return 'rgba(67, 233, 123, 0.8)';
        if (value > 50) return 'rgba(64, 172, 254, 0.8)';
        return 'rgba(245, 87, 108, 0.8)';
    });

    conservationPlotChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cost Saved (RM)',
                data: costSaved,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        family: 'Poppins',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Poppins',
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.x.toLocaleString()} Liters Saved`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' L';
                        },
                        font: {
                            family: 'Poppins'
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            family: 'Poppins'
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update conservation plot table
 */
function updateConservationPlotTable(plots) {
    const tableBody = document.getElementById('conservationPlotTableBody');
    tableBody.innerHTML = '';

    if (plots.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    No plot data available
                </td>
            </tr>
        `;
        return;
    }

    plots.forEach(plot => {
        const row = document.createElement('tr');
        
        // Efficiency badge color
        let efficiencyClass = 'bg-danger';
        if (plot.efficiencyIndex >= 80) efficiencyClass = 'bg-success';
        else if (plot.efficiencyIndex >= 60) efficiencyClass = 'bg-warning';

        // Percentage badge color based on moisture thresholds
        let percentageClass = 'bg-danger';
        if (plot.percentageSaved >= moistureThresholds.optimal_min) percentageClass = 'bg-success';
        else if (plot.percentageSaved >= moistureThresholds.low) percentageClass = 'bg-warning';

        // Fuel/Electricity display
        let fuelElecText = '';
        if (plot.fuelSaved > 0) {
            fuelElecText += `${plot.fuelSaved.toFixed(1)}L`;
        }
        if (plot.electricitySaved > 0) {
            if (fuelElecText) fuelElecText += ', ';
            fuelElecText += `${plot.electricitySaved.toFixed(1)}kWh`;
        }

        row.innerHTML = `
            <td>
                <strong>${plot.plotName}</strong>
                <br>
                <small class="text-muted">${plot.sensorId}</small>
            </td>
            <td>${plot.traditionalPumpHours.toFixed(1)}h</td>
            <td>${plot.smartPumpHours.toFixed(1)}h</td>
            <td><strong class="text-success">${plot.pumpHoursSaved.toFixed(1)}h</strong></td>
            <td><strong class="text-primary">RM${parseFloat(plot.totalCostSaved).toFixed(2)}</strong></td>
            <td><small>${fuelElecText}</small></td>
            <td>
                <span class="badge ${efficiencyClass}">${plot.efficiencyIndex}%</span>
            </td>
            <td>
                <span class="badge ${percentageClass}">${plot.percentageSaved}%</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Water Conservation Event Listeners
document.getElementById('loadConservationBtn').addEventListener('click', loadWaterConservationData);
document.getElementById('conservationPeriod').addEventListener('change', () => {
    // Auto-reload if data is already displayed
    if (document.getElementById('conservationDataDisplay').style.display !== 'none') {
        loadWaterConservationData();
    }
});

// PDF Download Functionality
document.getElementById('downloadPDFBtn')?.addEventListener('click', async () => {
    const button = document.getElementById('downloadPDFBtn');
    const originalHTML = button.innerHTML;
    
    try {
        // Show loading state
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
        
        const response = await fetch(`${API_BASE_URL}/analytics/report/weekly`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate PDF report');
        }
        
        // Get the PDF blob
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        a.download = `aquametic-weekly-report-${date}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success message
        if (window.Swal) {
            Swal.fire({
                icon: 'success',
                title: 'Report Downloaded!',
                text: 'Your weekly report has been downloaded successfully.',
                confirmButtonColor: '#2E7D32',
                timer: 3000
            });
        }
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Download Failed',
                text: error.message || 'Failed to generate PDF report. Please try again.',
                confirmButtonColor: '#dc3545'
            });
        }
    } finally {
        // Reset button state
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
});
// Initialize on page load
fetchPlots();