import { API_BASE_URL } from './api.js';
import { getCurrentUser, logout, getToken } from './auth.js';

// Get current user
const user = getCurrentUser();
if (!user) {
    window.location.href = 'index.html';
}

// Display username
document.getElementById('username-display').textContent = `Welcome, ${user.username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', logout);

let moistureChart = null;
let currentPlots = [];

// Fetch farmer stats with Authorization header
async function fetchFarmerStats() {
    const container = document.getElementById('plots-container');
    
    // Show loading skeletons
    if (window.SkeletonLoader) {
        window.SkeletonLoader.showSkeletons(container, 3, 'plot');
    }
    
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/dashboard/farmer-stats?userId=${user.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch farmer stats');
        }

        if (data.success) {
            currentPlots = data.plots;
            displayPlots(data.plots);
            populateSensorDropdown(data.plots);
            
            if (data.plotStats && data.plotStats.length > 0) {
                displayChart(data.plotStats[0].recentData);
            }
        }
    } catch (error) {
        console.error('Error fetching farmer stats:', error);
        if (window.toast) {
            window.toast.error('Failed to load dashboard data. Please try again.');
        }
        // Show empty state on error
        if (window.EmptyState) {
            window.EmptyState.show(container, {
                icon: '⚠️',
                title: 'Connection Error',
                message: 'Unable to load your plots. Please check your connection and try again.',
                actionText: 'Retry',
                actionCallback: 'fetchFarmerStats()'
            });
        }
    }
}

function displayPlots(plots) {
    const container = document.getElementById('plots-container');
    
    // Debug: Check what data we're receiving
    console.log('Plots data:', plots);
    if (plots && plots.length > 0) {
        console.log('First plot:', plots[0]);
        console.log('First plot name:', plots[0].name);
    }
    
    if (plots.length === 0) {
        // Show empty state
        if (window.EmptyState) {
            window.EmptyState.show(container, {
                icon: '🌱',
                title: 'No Plots Yet',
                message: 'You don\'t have any plots assigned. Contact your administrator to get started.',
                actionText: null,
                actionCallback: null
            });
        } else {
            container.innerHTML = '<div class="col-12"><p class="text-muted">No plots found. Click "Add Plot" to create your first plot</p></div>';
        }
        return;
    }
    
    container.innerHTML = plots.map((plot, index) => {
        // --- TIME-AWARE VALIDATION LOGIC ---
        let isValid = true;
        let statusBadge = '';
        let statusClass = '';
        const moisture = parseFloat(plot.current_moisture);
        
        // 1. Parse timestamp
        const lastUpdate = new Date(plot.timestamp || plot.last_updated || plot.time);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / 60000; // Convert ms to minutes
        
        // 2. Check for STALE DATA (> 70 mins means it missed its hourly wake-up)
        if (diffMinutes > 70) {
            isValid = false;
            statusBadge = 'Not Connected';
            // Optional: Show how long it's been down
            // statusBadge = `Offline (${Math.floor(diffMinutes / 60)}h ago)`;
            statusClass = 'bg-secondary text-white border';
        }
        // 3. Check for MISSING/GARBAGE data
        else if (plot.current_moisture === null || plot.current_moisture === undefined || plot.current_moisture === '') {
            isValid = false;
            statusBadge = 'No Signal';
            statusClass = 'bg-secondary text-white border';
        }
        // 4. Check for HARDWARE ERROR (Out of range)
        else if (moisture < 0 || moisture > 100) {
            isValid = false;
            statusBadge = 'Sensor Error';
            statusClass = 'bg-warning text-dark border border-warning';
        }
        // 5. LIVE & VALID (Normal Operation)
        else {
            if (moisture >= 60) {
                statusBadge = 'Good';
                statusClass = 'bg-success';
            } else if (moisture >= 40) {
                statusBadge = 'Wait';
                statusClass = 'bg-warning text-white';
            } else if (moisture >= 20) {
                statusBadge = 'Dry';
                statusClass = 'bg-warning text-white';
            } else {
                statusBadge = 'Critical';
                statusClass = 'bg-danger';
            }
        }
        
        // Generate advice based on moisture level
        let advice = '';
        if (!isValid) {
            advice = '<i class="fas fa-exclamation-circle text-secondary"></i> Unable to read sensor data';
        } else if (moisture >= 70) {
            advice = '<i class="fas fa-check-circle text-success"></i> Soil moisture is optimal';
        } else if (moisture >= 40) {
            advice = '<i class="fas fa-info-circle text-info"></i> Monitor moisture levels';
        } else {
            advice = '<i class="fas fa-exclamation-triangle text-danger"></i> Irrigation recommended';
        }
        
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
                        <span class="badge ${statusClass}" style="box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${statusBadge}</span>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="text-muted small fw-semibold" style="color: #546E7A;">Moisture Level</span>
                                <span class="fw-bold" style="font-size: 1.3rem; background: linear-gradient(135deg, #2E7D32, #66BB6A); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${plot.current_moisture}%</span>
                            </div>
                            <div class="progress" style="height: 12px; border-radius: 10px;">
                                <div class="progress-bar ${statusClass} progress-bar-animated" role="progressbar" 
                                     style="width: 0%; transition: width 1s ease;" 
                                     data-target="${plot.current_moisture}"
                                     aria-valuenow="0" 
                                     aria-valuemin="0" 
                                     aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div class="mb-3 p-2" style="background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 10px;">
                            <small class="d-flex align-items-center mb-2" style="color: #546E7A;">
                                <i class="fas fa-microchip floating-icon" style="color: #2E7D32; margin-right: 8px; font-size: 1rem;"></i>
                                <span class="fw-semibold">${plot.sensor_id}</span>
                            </small>
                            <small class="d-flex align-items-center" style="color: #546E7A;">
                                <i class="fas fa-map-marker-alt floating-icon" style="color: #F9A825; margin-right: 8px; font-size: 1rem;"></i>
                                <span>${plot.location || 'Location not set'}</span>
                            </small>
                        </div>
                        <div class="alert py-2 px-3 mb-3 small" style="background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border-left: 4px solid #2E7D32; border-radius: 8px;">
                            ${advice}
                        </div>
                        <button class="btn btn-outline-primary btn-sm w-100 view-plot-btn" style="font-weight: 600; border-width: 2px;">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Animate progress bars
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
    
    // Add click handlers to load plot details
    document.querySelectorAll('.view-plot-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const card = btn.closest('.plot-card');
            const plotId = card.dataset.plotId;
            const sensorId = card.dataset.sensorId;
            await viewPlot(plotId, sensorId);
        });
    });
}

function populateSensorDropdown(plots) {
    const dropdown = document.getElementById('manual-sensor-id');
    
    dropdown.innerHTML = '<option value="">Select a sensor...</option>' +
        plots.map(plot => `
            <option value="${plot.sensor_id}">${plot.name} (${plot.sensor_id})</option>
        `).join('');
}

async function loadSensorData(sensorId) {
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/dashboard/sensor-data/${sensorId}?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displaySensorData(data.data);
            displayChart(data.data);
        }
    } catch (error) {
        console.error('Error loading sensor data:', error);
    }
}

function displaySensorData(data) {
    const container = document.getElementById('sensor-data-container');
    
    if (data.length === 0) {
        container.innerHTML = '<p>No sensor data available.</p>';
        return;
    }
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Moisture Value</th>
                    <th>Offline Sync</th>
                </tr>
            </thead>
            <tbody>
                ${data.slice(0, 10).map(item => `
                    <tr>
                        <td>${new Date(item.timestamp).toLocaleString()}</td>
                        <td>${item.moisture_value}%</td>
                        <td>${item.sync_metadata?.is_offline_sync ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function displayChart(sensorData) {
    if (!sensorData || sensorData.length === 0) return;
    
    // Sort data by timestamp (oldest to newest for chart)
    const sortedData = [...sensorData].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    const labels = sortedData.map(item => 
        new Date(item.timestamp).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    );
    const values = sortedData.map(item => item.moisture_value);
    
    const ctx = document.getElementById('moistureChart');
    
    // Destroy existing chart if it exists
    if (moistureChart) {
        moistureChart.destroy();
    }
    
    moistureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Moisture Level (%)',
                data: values,
                borderColor: '#039BE5',
                backgroundColor: 'rgba(3, 155, 229, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#2E7D32',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
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
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Moisture %'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
    
    // Enhance chart with animations
    if (window.ChartAnimations) {
        window.ChartAnimations.enhanceChart(moistureChart);
    }
}

// Load Smart Irrigation Advice
let currentPlotMap = null;

async function loadSmartAdvice(plotId) {
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/plots/${plotId}/advice`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch advice');
        }
        
        if (data.success) {
            // Show the advice card
            const adviceCard = document.getElementById('advice-card');
            const adviceStatus = document.getElementById('advice-status');
            const adviceText = document.getElementById('advice-text');
            const weatherInfo = document.getElementById('weather-info');
            
            // Update content
            adviceStatus.textContent = data.status;
            adviceText.textContent = data.advice;
            weatherInfo.textContent = `Weather: ${data.weather.rain_prob}% chance of rain, ${data.weather.rain_amount}mm expected | Current Moisture: ${data.current_moisture}%`;
            
            // Change border color based on status
            adviceCard.style.borderLeftColor = data.color_code;
            adviceCard.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading smart advice:', error);
        // Hide advice card on error
        document.getElementById('advice-card').style.display = 'none';
    }
}

// Render Plot Map
function renderPlotMap(lat, lng) {
    // Show the map section
    const mapSection = document.getElementById('plot-map-section');
    mapSection.style.display = 'block';
    
    // Remove existing map if any
    if (currentPlotMap) {
        currentPlotMap.remove();
    }
    
    // Initialize Leaflet map
    currentPlotMap = L.map('plot-map').setView([lat, lng], 15);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(currentPlotMap);
    
    // Add a red marker at the plot location
    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    L.marker([lat, lng], { icon: redIcon })
        .addTo(currentPlotMap)
        .bindPopup('Plot Location')
        .openPopup();
}

// View Plot - Load all plot details
async function viewPlot(plotId, sensorId) {
    // Load sensor data
    await loadSensorData(sensorId);
    
    // Load smart irrigation advice
    await loadSmartAdvice(plotId);
    
    // Find the plot to get its coordinates
    const plot = currentPlots.find(p => p._id === plotId);
    if (plot && plot.location) {
        // Parse location "lat, lng"
        const coords = plot.location.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            renderPlotMap(coords[0], coords[1]);
        }
    }
}

// Manual input form handler
const manualInputForm = document.getElementById('manualInputForm');
const manualInputMessage = document.getElementById('manual-input-message');

manualInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sensorId = document.getElementById('manual-sensor-id').value;
    const moistureValue = parseFloat(document.getElementById('manual-moisture').value);
    
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/sensor/manual`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sensor_id: sensorId,
                moisture_value: moistureValue
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            manualInputMessage.textContent = 'Sensor reading saved successfully!';
            manualInputMessage.className = 'form-message success';
            manualInputForm.reset();
            
            // Show success toast
            if (window.toast) {
                window.toast.success('Sensor reading saved successfully!');
            }
            
            // Refresh data
            setTimeout(() => {
                fetchFarmerStats();
                loadSensorData(sensorId);
                manualInputMessage.textContent = '';
            }, 2000);
        } else {
            throw new Error(data.error || 'Failed to save reading');
        }
    } catch (error) {
        manualInputMessage.textContent = error.message || 'Failed to save sensor reading';
        manualInputMessage.className = 'form-message error';
        
        // Show error toast
        if (window.toast) {
            window.toast.error(error.message || 'Failed to save sensor reading');
        }
    }
});

// Initialize dashboard
fetchFarmerStats();

// Auto-refresh dashboard every 30 seconds to get real-time updates
setInterval(() => {
    fetchFarmerStats();
    console.log('Dashboard refreshed with latest data');
}, 30000); // 30 seconds

// Add Plot functionality with SweetAlert2
const addBtn = document.getElementById('dashboardAddPlotBtn');
if (addBtn) {
    addBtn.addEventListener('click', async () => {
        const { value: formValues } = await Swal.fire({
            title: '<i class="fas fa-map-marked-alt text-success"></i> Add New Plot',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <div class="mb-3">
                        <label class="form-label fw-semibold" style="display: block; margin-bottom: 8px; color: #2E7D32;">
                            <i class="fas fa-tag"></i> Plot Name <span style="color: red;">*</span>
                        </label>
                        <input id="swal-name" class="swal2-input" placeholder="Enter plot name (e.g., North Field)" 
                            style="width: 100%; margin: 0; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px;">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-semibold" style="display: block; margin-bottom: 8px; color: #2E7D32;">
                            <i class="fas fa-seedling"></i> Crop Type
                        </label>
                        <select id="swal-crop" class="swal2-input" 
                                style="width: 100%; margin: 0; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px 40px 12px 12px; height: 50px; appearance: auto; -webkit-appearance: menulist; -moz-appearance: menulist; background-position: right 12px center;">
                            <option value="">Select crop type</option>
                            <option value="Rice">🌾 Rice</option>
                            <option value="Corn">🌽 Corn</option>
                            <option value="Wheat">🌾 Wheat</option>
                            <option value="Vegetables">🥬 Vegetables</option>
                            <option value="Fruits">🍎 Fruits</option>
                            <option value="Other">🌱 Other</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-semibold" style="display: block; margin-bottom: 8px; color: #2E7D32;">
                            <i class="fas fa-microchip"></i> Sensor ID <span style="color: red;">*</span>
                        </label>
                        <input id="swal-sensor" class="swal2-input" placeholder="e.g., PICO_01" 
                               style="width: 100%; margin: 0; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px; text-transform: uppercase;">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-semibold" style="display: block; margin-bottom: 8px; color: #2E7D32;">
                            <i class="fas fa-map-pin"></i> Location <span style="color: red;">*</span>
                        </label>
                        <button type="button" id="useLocationBtn" class="btn btn-primary w-100 mb-2" 
                                style="background: linear-gradient(135deg, #4CAF50, #2E7D32); border: none; padding: 12px; border-radius: 8px; font-weight: 600;">
                            <i class="fas fa-crosshairs"></i> Use My Current Location
                        </button>
                        <div style="text-align: center; margin: 10px 0; color: #999;">
                            <span style="position: relative;">
                                <span style="position: absolute; left: -50px; right: -50px; top: 50%; height: 1px; background: #ddd; z-index: 0;"></span>
                                <span style="background: white; padding: 0 10px; position: relative; z-index: 1;">OR</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="row" style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label class="form-label fw-semibold" style="display: block; margin-bottom: 8px; color: #2E7D32;">
                                <i class="fas fa-map-marker-alt"></i> Latitude
                            </label>
                            <input id="swal-lat" type="number" step="any" class="swal2-input" placeholder="14.5995" 
                                   style="width: 100%; margin: 0; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px;">
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label fw-semibold" style="display: block; margin-bottom: 8px; color: #2E7D32;">
                                <i class="fas fa-map-marker-alt"></i> Longitude
                            </label>
                            <input id="swal-lng" type="number" step="any" class="swal2-input" placeholder="120.9842" 
                                   style="width: 100%; margin: 0; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px;">
                        </div>
                    </div>
                    
                    <div class="mt-3 p-3" style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-left: 4px solid #2E7D32; border-radius: 8px;">
                        <div style="color: #1b5e20; margin-bottom: 8px;">
                            <i class="fas fa-info-circle"></i> <strong>How to find coordinates:</strong>
                        </div>
                        <small style="color: #2e7d32; display: block; line-height: 1.6;">
                            1. Click "Use My Current Location" button above<br>
                            2. <strong>OR</strong> Open <a href="https://www.google.com/maps" target="_blank" style="color: #1565C0; font-weight: 600;">Google Maps</a><br>
                            3. Right-click your plot location → First number is Latitude, second is Longitude
                        </small>
                    </div>
                </div>
            `,
            width: '600px',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-plus-circle"></i> Create Plot',
            cancelButtonText: '<i class="fas fa-times"></i> Cancel',
            confirmButtonColor: '#2E7D32',
            cancelButtonColor: '#757575',
            customClass: {
                popup: 'rounded-3 shadow-lg',
                confirmButton: 'btn btn-success px-4 py-2',
                cancelButton: 'btn btn-secondary px-4 py-2',
                actions: 'gap-3'
            },
            buttonsStyling: false,
            didOpen: () => {
                // Add event listener for the "Use My Current Location" button
                const useLocationBtn = document.getElementById('useLocationBtn');
                const latInput = document.getElementById('swal-lat');
                const lngInput = document.getElementById('swal-lng');
                
                useLocationBtn.addEventListener('click', () => {
                    useLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting your location...';
                    useLocationBtn.disabled = true;
                    
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                latInput.value = position.coords.latitude.toFixed(6);
                                lngInput.value = position.coords.longitude.toFixed(6);
                                useLocationBtn.innerHTML = '<i class="fas fa-check-circle"></i> Location Set!';
                                useLocationBtn.style.background = 'linear-gradient(135deg, #66BB6A, #43A047)';
                                
                                // Show success toast
                                if (window.toast) {
                                    window.toast.success('Location detected successfully!');
                                }
                                
                                setTimeout(() => {
                                    useLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                                    useLocationBtn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
                                    useLocationBtn.disabled = false;
                                }, 2000);
                            },
                            (error) => {
                                useLocationBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Location Access Denied';
                                useLocationBtn.style.background = '#f44336';
                                
                                // Show error toast
                                if (window.toast) {
                                    window.toast.error('Please enable location access in your browser');
                                }
                                
                                setTimeout(() => {
                                    useLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                                    useLocationBtn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
                                    useLocationBtn.disabled = false;
                                }, 3000);
                            }
                        );
                    } else {
                        useLocationBtn.innerHTML = '<i class="fas fa-times-circle"></i> Location Not Supported';
                        useLocationBtn.style.background = '#f44336';
                        
                        if (window.toast) {
                            window.toast.error('Geolocation is not supported by your browser');
                        }
                        
                        setTimeout(() => {
                            useLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                            useLocationBtn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
                            useLocationBtn.disabled = false;
                        }, 3000);
                    }
                });
            },
            preConfirm: () => {
                const name = document.getElementById('swal-name').value.trim();
                const crop = document.getElementById('swal-crop').value;
                const sensor = document.getElementById('swal-sensor').value.trim().toUpperCase();
                const lat = document.getElementById('swal-lat').value;
                const lng = document.getElementById('swal-lng').value;

                if (!name || !sensor || !lat || !lng) {
                    Swal.showValidationMessage('<i class="fas fa-exclamation-triangle"></i> Please fill in all required fields (marked with *)');
                    return false;
                }

                if (isNaN(lat) || isNaN(lng)) {
                    Swal.showValidationMessage('<i class="fas fa-exclamation-triangle"></i> Latitude and Longitude must be valid numbers');
                    return false;
                }

                return {
                    name: name,
                    crop_type: crop,
                    sensor_id: sensor,
                    location: {
                        lat: parseFloat(lat),
                        lng: parseFloat(lng)
                    }
                }
            }
        });

        if (formValues) {
            try {
                // Debugging: Log what we are sending
                console.log("Sending Data:", formValues);

                const token = getToken();
                const response = await fetch(`${API_BASE_URL}/plots`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formValues)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to add plot');
                }

                await Swal.fire({
                    icon: 'success',
                    title: '<span style="color: #2E7D32;">Plot Created Successfully!</span>',
                    html: `<p>Your new plot <strong>${formValues.name}</strong> has been added to your dashboard.</p>`,
                    confirmButtonText: 'View Plots',
                    confirmButtonColor: '#2E7D32',
                    customClass: {
                        confirmButton: 'btn btn-success px-4'
                    },
                    buttonsStyling: false
                });
                fetchFarmerStats(); // Reload plots to show new one

            } catch (error) {
                console.error(error);
                const msg = error.message || 'Failed to add plot';
                await Swal.fire({
                    icon: 'error',
                    title: 'Failed to Create Plot',
                    text: msg,
                    confirmButtonColor: '#2E7D32',
                    customClass: {
                        confirmButton: 'btn btn-success px-4'
                    },
                    buttonsStyling: false
                });
            }
        }
    });
}
