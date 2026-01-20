// --- AUTHENTICATION CHECK ---
const token = localStorage.getItem('token');
if (!token) {
    // No token found? Kick them out!
    window.location.href = '../auth/index.html'; 
}

// --- LOGOUT LOGIC (Copy this too) ---
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../auth/index.html';
});

import { API_BASE_URL } from '../../shared/js/api.js';
import { getCurrentUser, logout, getToken } from '../../shared/js/auth.js';

// Check authentication
const user = getCurrentUser();
if (!user) {
    window.location.href = '../auth/index.html';
}

// Cache for crop-specific moisture thresholds
const cropThresholdsCache = {};

/**
 * Fetches moisture thresholds for a specific crop type
 */
async function getCropThresholds(cropType) {
    // Return from cache if available
    if (cropThresholdsCache[cropType]) {
        return cropThresholdsCache[cropType];
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/settings/moisture-thresholds/${encodeURIComponent(cropType)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            cropThresholdsCache[cropType] = data.data.thresholds;
            return data.data.thresholds;
        }
    } catch (error) {
        console.error(`Error fetching thresholds for ${cropType}:`, error);
    }
    
    // Return default if fetch fails
    return { critical: 20, low: 30, optimal_min: 40, optimal_max: 70, high: 80 };
}

// Display username
const usernameDisplay = document.getElementById('username-display');
if (usernameDisplay) {
    usernameDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${user.username}`;
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', logout);

// Get plots container
const plotsContainer = document.getElementById('plots-container');

// Fetch and display plots
async function loadPlots() {
    // Show loading skeletons
    if (window.SkeletonLoader) {
        window.SkeletonLoader.showSkeletons(plotsContainer, 3, 'plot');
    }
    
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/plots`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch plots');
        }

        if (data.success) {
            // Preload thresholds for all unique crop types
            const uniqueCropTypes = [...new Set(data.plots.map(p => p.crop_type || 'default'))];
            await Promise.all(uniqueCropTypes.map(cropType => getCropThresholds(cropType)));
            
            displayPlots(data.plots);
            if (window.toast) {
                window.toast.success(`Loaded ${data.plots.length} plot${data.plots.length !== 1 ? 's' : ''}`, 2000);
            }
        }
    } catch (error) {
        console.error('Error loading plots:', error);
        if (window.toast) {
            window.toast.error('Failed to load plots. Please try again.');
        }
        if (window.EmptyState) {
            window.EmptyState.show(plotsContainer, {
                icon: '⚠️',
                title: 'Connection Error',
                message: 'Unable to load plots. Please check your connection.',
                actionText: 'Retry',
                actionCallback: 'loadPlots()'
            });
        } else {
            plotsContainer.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger" role="alert">
                        <i class="fas fa-exclamation-circle"></i> Failed to load plots. Please try again.
                    </div>
                </div>
            `;
        }
    }
}

// Display plots in cards
function displayPlots(plots) {
    // Debug: Check what data we're receiving
    console.log('Plots data:', plots);
    if (plots && plots.length > 0) {
        console.log('First plot:', plots[0]);
        console.log('First plot name:', plots[0].name);
    }
    
    if (!plots || plots.length === 0) {
        if (window.EmptyState) {
            window.EmptyState.show(plotsContainer, {
                icon: '🌱',
                title: 'No Plots Yet',
                message: 'Click "Add Plot" to create your first plot and start monitoring.',
                actionText: null
            });
        } else {
            plotsContainer.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-map-marked-alt fa-4x text-muted mb-3"></i>
                    <h5 class="text-muted">No plots found</h5>
                    <p class="text-muted">Click "Add Plot" to create your first plot</p>
                </div>
            `;
        }
        return;
    }

    plotsContainer.innerHTML = plots.map(plot => {
        const moisture = plot.current_moisture;
        const cropType = plot.crop_type || 'default';
        
        // Get thresholds for this crop (will use cached or default)
        const thresholds = cropThresholdsCache[cropType] || { critical: 20, low: 30, optimal_min: 40, optimal_max: 70, high: 80 };
        
        let statusBadge = '';
        let statusClass = '';
        let isConnected = true;
        
        // Check if sensor is connected (data received within last 2 minutes)
        const timestampValue = plot.timestamp || plot.last_updated || plot.time;
        if (!timestampValue || moisture === null || moisture === undefined || moisture === '') {
            isConnected = false;
        } else {
            const lastUpdate = new Date(timestampValue);
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / 60000;
            
            // If no data for 2 minutes (Pico sends every 10 seconds), mark as disconnected
            if (diffMinutes > 2) {
                isConnected = false;
            }
        }
        
        // Handle disconnected sensor
        if (!isConnected) {
            statusBadge = 'Not Connected';
            statusClass = 'bg-secondary text-white';
        }
        // Use smart irrigation logic from backend if available
        else if (plot.irrigation_status && plot.irrigation_advice) {
            statusBadge = plot.irrigation_status;
            
            switch (plot.irrigation_status) {
                case 'CRITICAL':
                    statusClass = 'bg-danger';
                    break;
                case 'IRRIGATE':
                    statusClass = 'bg-info text-white';
                    break;
                case 'WAIT':
                    statusClass = 'bg-warning text-dark';
                    break;
                case 'GOOD':
                    statusClass = 'bg-success';
                    break;
                default:
                    statusClass = 'bg-secondary';
            }
        } else {
            // Use crop-specific thresholds for moisture-based logic (only if connected)
            const moistureValue = parseFloat(moisture);
            if (moistureValue >= thresholds.optimal_min) {
                statusBadge = 'Good';
                statusClass = 'bg-success';
            } else if (moistureValue >= thresholds.low) {
                statusBadge = 'Low';
                statusClass = 'bg-warning text-dark';
            } else {
                statusBadge = 'Critical';
                statusClass = 'bg-danger';
            }
        }

        // Extract weather data if available
        const weather = plot.weather || {};
        const temp = weather.temperature !== undefined ? weather.temperature : 'N/A';
        const humidity = weather.humidity !== undefined ? weather.humidity : 'N/A';
        const rain = weather.precipitation_probability !== undefined ? weather.precipitation_probability : 'N/A';
        const wind = weather.wind_speed !== undefined ? weather.wind_speed : 'N/A';
        
        // Debug individual plot
        console.log('Processing plot:', plot);
        console.log('Plot name value:', plot.name);
        console.log('Plot object keys:', Object.keys(plot));
        
        const plotName = plot.name || plot.plot_name || plot.plotName || 'Unnamed Plot';
        console.log('Using plot name:', plotName);
        
        return `
            <div class="col-md-4 col-sm-6 stagger-item">
                <div class="card h-100 plot-card card-hover-lift" data-plot-id="${plot._id}" data-sensor-id="${plot.sensor_id}">
                    <div class="card-header d-flex justify-content-between align-items-center animated-gradient">
                        <h6 class="mb-0 fw-bold" style="color: #A5D6A7; font-size: 1.3rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); letter-spacing: 0.5px;">
                            <i class="fas fa-leaf floating-icon" style="margin-right: 8px;"></i>
                            ${plotName}
                        </h6>
                        <span class="badge sensor-status ${statusClass}" style="box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${statusBadge}</span>
                    </div>
                    <div class="card-body">
                        <div class="mb-3 p-2" style="background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 10px;">
                            <small class="d-flex align-items-center mb-2" style="color: #546E7A;">
                                <i class="fas fa-seedling" style="color: #66BB6A; margin-right: 8px; font-size: 1rem;"></i>
                                <strong>Crop Type:</strong>
                                <span class="ms-2 fw-semibold">${plot.crop_type || 'Not specified'}</span>
                            </small>
                            <small class="d-flex align-items-center mb-2" style="color: #546E7A;">
                                <i class="fas fa-ruler-combined" style="color: #FF6F00; margin-right: 8px; font-size: 1rem;"></i>
                                <strong>Plot Size:</strong>
                                <span class="ms-2 fw-semibold">${plot.size_acres || 2.5} acres (~${((plot.size_acres || 2.5) * 0.404686).toFixed(2)} ha)</span>
                            </small>
                            <small class="d-flex align-items-center" style="color: #546E7A;">
                                <i class="fas fa-broadcast-tower" style="color: #1976D2; margin-right: 8px; font-size: 1rem;"></i>
                                <strong>Sensors:</strong>
                                <span class="ms-2 fw-semibold">${plot.number_of_sensors || 1} sensor${(plot.number_of_sensors || 1) > 1 ? 's' : ''}</span>
                            </small>
                        </div>
                        
                        <div class="mb-3 p-2" style="background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 10px;">
                            <small class="d-flex align-items-center mb-2" style="color: #546E7A;">
                                <i class="fas fa-microchip" style="color: #2E7D32; margin-right: 8px; font-size: 1rem;"></i>
                                <span class="fw-semibold">${plot.sensor_id}</span>
                            </small>
                            <small class="d-flex align-items-center" style="color: #546E7A;">
                                <i class="fas fa-map-marker-alt" style="color: #F9A825; margin-right: 8px; font-size: 1rem;"></i>
                                <span>${plot.location || 'Not set'}</span>
                            </small>
                        </div>
                        
                        <div class="mb-4">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <small class="fw-semibold" style="color: #546E7A;">
                                    <i class="fas fa-tint" style="color: #039BE5;"></i> Current Moisture
                                </small>
                                ${isConnected ? 
                                    `<span class="fw-bold moisture-value" style="font-size: 1.3rem; background: linear-gradient(135deg, #2E7D32, #66BB6A); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${moisture}%</span>` :
                                    `<span class="fw-bold text-muted moisture-value" style="font-size: 1rem;">No Data</span>`
                                }
                            </div>
                            ${isConnected ? 
                                `<div class="progress" style="height: 12px; border-radius: 10px;">
                                    <div class="progress-bar ${statusClass} progress-bar-animated" role="progressbar" 
                                        style="width: 0%; transition: width 1s ease;" 
                                        data-target="${moisture}"
                                        aria-valuenow="0" 
                                        aria-valuemin="0" 
                                        aria-valuemax="100"></div>
                                </div>` :
                                `<div class="alert alert-secondary mb-0 py-2" style="font-size: 0.85rem;">
                                    <i class="fas fa-unlink"></i> Sensor disconnected
                                </div>`
                            }
                        </div>
                        
                        <!-- Weather Data Section -->
                        <div class="mb-3 p-3" style="background: linear-gradient(135deg, #e3f2fd, #e8f5e9); border-radius: 12px; border-left: 4px solid #039BE5;">
                            <small class="d-block mb-2 fw-bold" style="color: #1B5E20;">
                                <i class="fas fa-cloud-sun" style="color: #F9A825;"></i> Weather Conditions
                            </small>
                            <div class="row g-2 small">
                                <div class="col-6">
                                    <div class="d-flex align-items-center mb-1">
                                        <i class="fas fa-thermometer-half text-danger me-2"></i>
                                        <strong>${temp}${temp !== 'N/A' ? '°C' : ''}</strong>
                                    </div>
                                    <small class="text-muted">Temperature</small>
                                </div>
                                <div class="col-6">
                                    <div class="d-flex align-items-center mb-1">
                                        <i class="fas fa-tint text-info me-2"></i>
                                        <strong>${humidity}${humidity !== 'N/A' ? '%' : ''}</strong>
                                    </div>
                                    <small class="text-muted">Humidity</small>
                                </div>
                                <div class="col-6">
                                    <div class="d-flex align-items-center mb-1">
                                        <i class="fas fa-cloud-rain text-primary me-2"></i>
                                        <span>${rain}${rain !== 'N/A' ? '%' : ''}</span>
                                    </div>
                                    <small class="text-muted">Rain Chance</small>
                                </div>
                                <div class="col-6">
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-wind text-secondary me-1"></i>
                                        <span>${wind}${wind !== 'N/A' ? ' km/h' : ''}</span>
                                    </div>
                                    <small class="text-muted">Wind Speed</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="viewPlotDetails('${plot._id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn btn-outline-success btn-sm" onclick="editPlot('${plot._id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="deletePlot('${plot._id}', '${plot.name}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Animate progress bars after render
    setTimeout(() => {
        document.querySelectorAll('.progress-bar').forEach(bar => {
            const target = bar.dataset.target;
            if (window.ChartAnimations) {
                window.ChartAnimations.animateProgressBar(bar, target);
            } else {
                bar.style.width = target + '%';
                bar.setAttribute('aria-valuenow', target);
            }
        });
    }, 300);
}

// View plot details
window.viewPlotDetails = function(plotId) {
    // Redirect to farmer dashboard with plot details
    window.location.href = `dashboard.html?plotId=${plotId}`;
};

// Delete plot
window.deletePlot = async function(plotId, plotName) {
    const result = await Swal.fire({
        title: 'Delete Plot?',
        text: `Are you sure you want to delete "${plotName}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });
    
    if (result.isConfirmed) {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE_URL}/plots/${plotId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete plot');
            }
            
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: `${plotName} has been deleted.`,
                    confirmButtonColor: '#2E7D32',
                    confirmButtonText: 'OK'
                });
                
                // Reload plots
                loadPlots();
            }
        } catch (error) {
            console.error('Error deleting plot:', error);
            Swal.fire({
                icon: 'error',
                title: 'Delete Failed',
                text: error.message || 'Failed to delete plot. Please try again.',
                confirmButtonColor: '#dc3545',
                confirmButtonText: 'OK'
            });
        }
    }
};

// Load plots on page load
loadPlots();

// Edit plot using SweetAlert2
window.editPlot = async function(plotId) {
    try {
        // Fetch plot details first
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/plots/${plotId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch plot details');
        }

        if (data.success) {
            const plot = data.plot;
            
            // Show SweetAlert2 form with current values
            const { value: formValues } = await Swal.fire({
                title: '<i class="fas fa-edit"></i> Edit Plot',
                html: `
                    <div style="text-align: left;">
                        <div class="mb-3">
                            <label for="swal-plotname" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-leaf"></i> Plot Name *
                            </label>
                            <input id="swal-plotname" class="swal2-input" style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="Plot Name" value="${plot.name || ''}" required>
                        </div>
                        <div class="mb-3">
                            <label for="swal-croptype" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-seedling"></i> Crop Type
                            </label>
                            <input id="swal-croptype" class="swal2-input" style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="e.g., Wheat, Rice, Corn" value="${plot.crop_type || ''}">
                        </div>
                        <div class="mb-3">
                            <label for="swal-location" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-map-marker-alt"></i> Location
                            </label>
                            <input id="swal-location" class="swal2-input" style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="Plot location" value="${plot.location || ''}">
                        </div>
                        <div class="mb-3">
                            <label for="swal-size" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-ruler-combined"></i> Size (acres) *
                            </label>
                            <input id="swal-size" type="number" step="0.1" min="0.01" max="2500" 
                                class="swal2-input" style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="e.g., 5.0" value="${plot.size_acres || 2.5}" 
                                oninput="document.getElementById('hectare-display').innerText = '~' + (this.value * 0.404686).toFixed(2) + ' hectares'">
                            <small id="hectare-display" class="text-muted d-block" style="font-size: 0.75rem; margin-top: 0.25rem;">
                                ~${((plot.size_acres || 2.5) * 0.404686).toFixed(2)} hectares
                            </small>
                        </div>
                        <div class="mb-3">
                            <label for="swal-sensor" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-microchip"></i> Sensor ID *
                            </label>
                            <input id="swal-sensor" type="text" class="swal2-input" 
                                style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="e.g., PICO_01" value="${plot.sensor_id || ''}">
                        </div>
                        <div class="mb-3">
                            <label for="swal-num-sensors" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-broadcast-tower"></i> # of Sensors *
                            </label>
                            <input id="swal-num-sensors" type="number" min="1" max="50" 
                                class="swal2-input" style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="Number of sensors" value="${plot.number_of_sensors || 1}">
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-check"></i> Save Changes',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#2E7D32',
                cancelButtonColor: '#6c757d',
                width: '650px',
                preConfirm: () => {
                    const plotName = document.getElementById('swal-plotname').value.trim();
                    const cropType = document.getElementById('swal-croptype').value.trim();
                    const location = document.getElementById('swal-location').value.trim();
                    const size = parseFloat(document.getElementById('swal-size').value);
                    const numSensors = parseInt(document.getElementById('swal-num-sensors').value);
                    const baseSensor = document.getElementById('swal-base-sensor').value.trim();

                    if (!plotName) {
                        Swal.showValidationMessage('Plot name is required');
                        return false;
                    }

                    if (!size || size <= 0) {
                        Swal.showValidationMessage('Plot size must be greater than 0');
                        return false;
                    }

                    if (!numSensors || numSensors < 1) {
                        Swal.showValidationMessage('Must have at least 1 sensor');
                        return false;
                    }

                    const sensorId = document.getElementById('swal-sensor').value.trim();
                    if (!sensorId) {
                        Swal.showValidationMessage('Sensor ID is required');
                        return false;
                    }

                    return {
                        name: plotName,
                        crop_type: cropType,
                        location: location,
                        size_acres: size,
                        sensor_id: sensorId,
                        number_of_sensors: numSensors
                    };
                }
            });

            // If user clicked Save
            if (formValues) {
                // Show loading
                Swal.fire({
                    title: 'Updating Plot...',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                // Send update request
                const updateResponse = await fetch(`${API_BASE_URL}/plots/${plotId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formValues)
                });

                const updateData = await updateResponse.json();

                if (!updateResponse.ok) {
                    throw new Error(updateData.error || 'Failed to update plot');
                }

                if (updateData.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Updated!',
                        text: `${formValues.name} has been updated successfully.`,
                        confirmButtonColor: '#2E7D32',
                        confirmButtonText: 'OK'
                    });

                    // Reload plots
                    loadPlots();
                }
            }
        }
    } catch (error) {
        console.error('Error editing plot:', error);
        Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error.message || 'Failed to update plot. Please try again.',
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'OK'
        });
    }
};

// 🚀 REAL-TIME UPDATES: Initialize WebSocket listeners when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only refresh every 5 minutes for full data sync - real-time updates handle the rest
    setInterval(loadPlots, 300000);

    // Setup real-time WebSocket updates
    if (window.RealtimeService) {

        window.RealtimeService.onEvent('sensorData', (data) => {
            console.log('📡 Real-time sensor update received:', data);
            
            // Find the plot card for this sensor by sensorId
            const plotCards = document.querySelectorAll('.plot-card');
            plotCards.forEach(card => {
                const sensorId = card.dataset.sensorId;
                if (sensorId && data.sensorId === sensorId) {
                    console.log(`🎯 Found matching card for sensor ${sensorId}`);
                    
                    // Update moisture value
                    const moistureElement = card.querySelector('.moisture-value');
                    if (moistureElement && data.moisture !== undefined) {
                        moistureElement.textContent = data.moisture.toFixed(1) + '%';
                        moistureElement.style.cssText = 'font-size: 1.3rem; background: linear-gradient(135deg, #2E7D32, #66BB6A); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: bold;';
                        console.log(`💧 Updated moisture to ${data.moisture}%`);
                    }

                    // Update connection status badge
                    const statusBadge = card.querySelector('.sensor-status');
                    if (statusBadge) {
                        statusBadge.className = 'badge sensor-status bg-success';
                        statusBadge.textContent = 'CONNECTED';
                    }

                    // Update progress bar if it exists
                    const progressBar = card.querySelector('.progress-bar');
                    if (progressBar && data.moisture !== undefined) {
                        progressBar.style.width = data.moisture + '%';
                        progressBar.setAttribute('aria-valuenow', data.moisture);
                        
                        // Update color based on moisture level
                        if (data.moisture >= 40) {
                            progressBar.className = 'progress-bar bg-success progress-bar-animated';
                        } else if (data.moisture >= 20) {
                            progressBar.className = 'progress-bar bg-warning text-dark progress-bar-animated';
                        } else {
                            progressBar.className = 'progress-bar bg-danger progress-bar-animated';
                        }
                    }

                    // Hide disconnected alert if visible
                    const disconnectedAlert = card.querySelector('.alert-secondary');
                    if (disconnectedAlert) {
                        disconnectedAlert.style.display = 'none';
                    }

                    console.log(`✅ Updated plot card for sensor ${sensorId} with moisture: ${data.moisture}%`);
                }
            });
        });

        window.RealtimeService.onEvent('sensorStatus', (data) => {
            console.log('🔌 Sensor status change:', data);
            
            const plotCards = document.querySelectorAll('.plot-card');
            plotCards.forEach(card => {
                const sensorId = card.dataset.sensorId;
                if (sensorId && data.sensorId === sensorId) {
                    const statusBadge = card.querySelector('.sensor-status');
                    if (statusBadge) {
                        if (data.connected) {
                            statusBadge.className = 'badge sensor-status bg-success';
                            statusBadge.textContent = 'CONNECTED';
                        } else {
                            statusBadge.className = 'badge sensor-status bg-secondary';
                            statusBadge.textContent = 'NOT CONNECTED';
                        }
                    }
                }
            });
        });

        console.log('✅ Real-time updates initialized for plots page');
    } else {
        console.warn('⚠️ RealtimeService not available - using polling only');
    }
});
