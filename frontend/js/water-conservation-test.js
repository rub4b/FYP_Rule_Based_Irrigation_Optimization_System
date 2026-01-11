import { API_BASE_URL } from './api.js';
import { getCurrentUser, getToken } from './auth.js';

// Check authentication
const user = getCurrentUser();
const token = getToken();

if (!user || !token) {
    alert('Please login first');
    window.location.href = 'index.html';
}

// Chart instances
let usageComparisonChart = null;
let plotSavingsChart = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const dataDisplay = document.getElementById('dataDisplay');
const loadDataBtn = document.getElementById('loadDataBtn');
const periodSelector = document.getElementById('periodSelector');
const waterCostInput = document.getElementById('waterCost');

// Load data on button click
loadDataBtn.addEventListener('click', loadWaterConservationData);

// Load data on page load
window.addEventListener('DOMContentLoaded', loadWaterConservationData);

// Period selector change
periodSelector.addEventListener('change', loadWaterConservationData);

/**
 * Fetch and display water conservation data
 */
async function loadWaterConservationData() {
    try {
        // Show loading state
        loadingState.style.display = 'block';
        errorState.style.display = 'none';
        dataDisplay.style.display = 'none';

        const period = periodSelector.value;
        const waterCost = waterCostInput.value;

        const response = await fetch(
            `${API_BASE_URL}/analytics/water-conservation?days=${period}&waterCostPerLiter=${waterCost}`,
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
        loadingState.style.display = 'none';
        dataDisplay.style.display = 'block';

        // Update summary cards
        updateSummaryCards(data);

        // Update configuration display
        updateConfigDisplay(data.configuration);

        // Render charts
        renderUsageComparisonChart(data);
        renderPlotSavingsChart(data.plots);

        // Update plot table
        updatePlotTable(data.plots);

        console.log('Water Conservation Data:', data);

    } catch (error) {
        console.error('Error loading water conservation data:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

/**
 * Update summary cards with data
 */
function updateSummaryCards(data) {
    document.getElementById('totalWaterSaved').textContent = 
        data.totalWaterSaved.toLocaleString();
    
    document.getElementById('totalCostSaved').textContent = 
        `${data.currency}${parseFloat(data.totalCostSaved).toLocaleString()}`;
    
    document.getElementById('percentageSaved').textContent = 
        `${data.percentageSaved}%`;
    
    document.getElementById('co2Saved').textContent = 
        `${parseFloat(data.co2Saved).toFixed(2)} kg`;
}

/**
 * Update configuration display
 */
function updateConfigDisplay(config) {
    const configDisplay = document.getElementById('configDisplay');
    configDisplay.innerHTML = `
        <span class="config-badge">
            <i class="fas fa-calendar-alt"></i> ${config.traditionalFrequency}
        </span>
        <span class="config-badge">
            <i class="fas fa-clock"></i> ${config.sessionDuration}
        </span>
        <span class="config-badge">
            <i class="fas fa-tint"></i> ${config.flowRate}
        </span>
        <span class="config-badge">
            <i class="fas fa-exclamation-triangle"></i> Critical: ${config.criticalThreshold}
        </span>
        <span class="config-badge">
            <i class="fas fa-chart-line"></i> Optimal: ${config.optimalRange}
        </span>
    `;
}

/**
 * Render usage comparison doughnut chart
 */
function renderUsageComparisonChart(data) {
    const ctx = document.getElementById('usageComparisonChart').getContext('2d');
    
    // Destroy existing chart
    if (usageComparisonChart) {
        usageComparisonChart.destroy();
    }

    usageComparisonChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Smart System (Used)', 'Water Saved'],
            datasets: [{
                data: [data.totalSmartUse, data.totalWaterSaved],
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
                            size: 14
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percentage = ((value / data.totalTraditionalUse) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString()} L (${percentage}%)`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Traditional: ${data.totalTraditionalUse.toLocaleString()} L`,
                    font: {
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
function renderPlotSavingsChart(plots) {
    const ctx = document.getElementById('plotSavingsChart').getContext('2d');
    
    // Destroy existing chart
    if (plotSavingsChart) {
        plotSavingsChart.destroy();
    }

    // Prepare data (top 10 plots)
    const topPlots = plots.slice(0, 10);
    const labels = topPlots.map(p => p.plotName);
    const waterSaved = topPlots.map(p => p.waterSaved);
    
    // Color based on savings amount
    const colors = waterSaved.map(value => {
        if (value > 1000) return 'rgba(67, 233, 123, 0.8)';
        if (value > 500) return 'rgba(64, 172, 254, 0.8)';
        return 'rgba(245, 87, 108, 0.8)';
    });

    plotSavingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Water Saved (Liters)',
                data: waterSaved,
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
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update plot details table
 */
function updatePlotTable(plots) {
    const tableBody = document.getElementById('plotTableBody');
    tableBody.innerHTML = '';

    if (plots.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
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

        // Percentage badge color
        let percentageClass = 'bg-danger';
        if (plot.percentageSaved >= 40) percentageClass = 'bg-success';
        else if (plot.percentageSaved >= 20) percentageClass = 'bg-warning';

        row.innerHTML = `
            <td>
                <strong>${plot.plotName}</strong>
                <br>
                <small class="text-muted">${plot.sensorId}</small>
            </td>
            <td>${plot.traditionalUse.toLocaleString()}</td>
            <td>${plot.smartUse.toLocaleString()}</td>
            <td><strong class="text-success">${plot.waterSaved.toLocaleString()}</strong></td>
            <td>₱${parseFloat(plot.costSaved).toFixed(2)}</td>
            <td>
                <span class="badge bg-info">${plot.irrigationEvents}</span>
            </td>
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
