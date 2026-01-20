import { API_BASE_URL } from '../../shared/js/api.js';
import { getCurrentUser, getToken } from '../../shared/js/auth.js';

// Check authentication
const user = getCurrentUser();
const token = getToken();

if (!user || !token) {
    alert('Please login first');
    window.location.href = '../auth/index.html';
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
const pumpTypeSelector = document.getElementById('pumpType');

// Load data on button click
loadDataBtn.addEventListener('click', loadCostSavingsData);

// Load data on page load
window.addEventListener('DOMContentLoaded', loadCostSavingsData);

// Period selector change
periodSelector.addEventListener('change', loadCostSavingsData);

/**
 * Fetch and display cost savings data
 */
async function loadCostSavingsData() {
    try {
        // Show loading state
        loadingState.style.display = 'block';
        errorState.style.display = 'none';
        dataDisplay.style.display = 'none';

        const period = periodSelector.value;
        const pumpType = pumpTypeSelector.value;

        const response = await fetch(
            `${API_BASE_URL}/analytics/cost-savings?days=${period}&pumpType=${pumpType}&dieselCostPerLiter=2.05&electricityCostPerKwh=0.571&pumpPowerKw=3&laborCostPerHour=15`,
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

        console.log('Cost Savings Data:', data);

    } catch (error) {
        console.error('Error loading cost savings data:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

/**
 * Update summary cards with data
 */
function updateSummaryCards(data) {
    document.getElementById('totalCostSaved').textContent = 
        `${data.currency}${parseFloat(data.totalCostSaved).toLocaleString()}`;
    
    document.getElementById('pumpHoursSaved').textContent = 
        `${data.totalPumpHoursSaved.toFixed(1)}h`;
    
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
            <i class="fas fa-clock"></i> Trad: ${config.traditionalDuration}
        </span>
        <span class="config-badge">
            <i class="fas fa-clock"></i> Smart: ${config.smartDuration}
        </span>
        <span class="config-badge">
            <i class="fas fa-bolt"></i> ${config.pumpPowerKw} pump
        </span>
        <span class="config-badge">
            <i class="fas fa-exclamation-triangle"></i> Critical: ${config.criticalThreshold}
        </span>
        <span class="config-badge">
            <i class="fas fa-chart-line"></i> Optimal: ${config.optimalRange}
        </span>
        <div class="mt-2">
            <strong>Cost Rates:</strong> ${config.costs.dieselPerLiter}/L diesel, ${config.costs.electricityPerKwh}/kWh, ${config.costs.laborPerHour}/hour labor
        </div>
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
                            const percentage = ((value / data.totalTraditionalPumpHours) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(1)} hours (${percentage}%)`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Traditional: ${data.totalTraditionalPumpHours.toFixed(1)} hours`,
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
    const costSaved = topPlots.map(p => parseFloat(p.totalCostSaved));
    
    // Color based on savings amount
    const colors = costSaved.map(value => {
        if (value > 100) return 'rgba(67, 233, 123, 0.8)';
        if (value > 50) return 'rgba(64, 172, 254, 0.8)';
        return 'rgba(245, 87, 108, 0.8)';
    });

    plotSavingsChart = new Chart(ctx, {
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
                    callbacks: {
                        label: function(context) {
                            return `RM ${context.parsed.x.toFixed(2)} Saved`;
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

        // Fuel/Electricity display
        let fuelElecText = '';
        if (plot.fuelSaved > 0) {
            fuelElecText += `${plot.fuelSaved.toFixed(1)}L diesel`;
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
