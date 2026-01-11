import { API_BASE_URL } from './api.js';
import { getCurrentUser, getToken } from './auth.js';

// Authentication check
const user = getCurrentUser();
const token = getToken();

if (!user || !token) {
    window.location.href = 'index.html';
}

// Display username
document.getElementById('username-display').innerHTML = `<i class="fas fa-user-circle"></i> ${user.username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// Chart instances
let moistureTrendChart = null;
let wateringFrequencyChart = null;

// Available plots
let availablePlots = [];
let selectedPlotSensorId = null;

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
        
        // Select first plot by default
        if (availablePlots.length > 0) {
            selectedPlotSensorId = availablePlots[0].sensor_id;
            document.getElementById('plotSelector').value = selectedPlotSensorId;
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
document.getElementById('plotSelector').addEventListener('change', (e) => {
    selectedPlotSensorId = e.target.value;
    if (selectedPlotSensorId) {
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
        
        // Count critical events (moisture < 20%)
        if (moisture < 20) {
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
    
    // Color code based on average moisture
    const badge = document.getElementById('avg-moisture-badge');
    if (avgMoisture >= 60) {
        badge.className = 'badge bg-success';
    } else if (avgMoisture >= 40) {
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
                label: 'Critical Events (Moisture < 20%)',
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
