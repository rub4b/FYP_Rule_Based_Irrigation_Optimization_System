import { API_BASE_URL } from '../../shared/js/api.js';
import { getCurrentUser, logout, getToken } from '../../shared/js/auth.js';

// Get current user
const user = getCurrentUser();
if (!user) {
    window.location.href = '../auth/index.html';
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
        let advice = '';
        const moisture = parseFloat(plot.current_moisture);
        
        // Check if we have backend smart irrigation logic
        if (plot.irrigation_status && plot.irrigation_advice) {
            // Use backend smart irrigation logic (with weather consideration)
            statusBadge = plot.irrigation_status;
            advice = plot.irrigation_advice;
            
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
            // Fallback: Validate sensor data first
            // 1. Parse timestamp - check all possible fields
            const timestampValue = plot.timestamp || plot.last_updated || plot.time;
            
            // 2. Check for MISSING data first
            if (!timestampValue || plot.current_moisture === null || plot.current_moisture === undefined || plot.current_moisture === '') {
                isValid = false;
                statusBadge = 'Not Connected';
                statusClass = 'bg-secondary text-white border';
            } else {
                const lastUpdate = new Date(timestampValue);
                const now = new Date();
                const diffMinutes = (now - lastUpdate) / 60000; // Convert ms to minutes
                
                // 3. Check for STALE DATA (> 15 mins for 10-second interval, or > 70 mins for hourly)
                if (diffMinutes > 15) {  // Changed from 70 to 15 minutes since Pico sends every 10 seconds
                    isValid = false;
                    statusBadge = 'Not Connected';
                    statusClass = 'bg-secondary text-white border';
                }
                // 4. Check for HARDWARE ERROR (Out of range)
                else if (moisture < 0 || moisture > 100) {
                    isValid = false;
                    statusBadge = 'Sensor Error';
                    statusClass = 'bg-warning text-dark border border-warning';
                }
                // 5. Simple moisture-based fallback (no weather data available)
                else {
                    if (moisture >= 40) {
                        statusBadge = 'Good';
                        statusClass = 'bg-success';
                    } else if (moisture >= 20) {
                        statusBadge = 'Dry';
                        statusClass = 'bg-warning text-dark';
                    } else {
                        statusBadge = 'Critical';
                        statusClass = 'bg-danger';
                    }
                }
            }
            
            // Generate advice based on moisture level (fallback)
            if (!isValid) {
                advice = '<i class="fas fa-exclamation-circle text-secondary"></i> Unable to read sensor data';
            } else if (moisture >= 40) {
                advice = '<i class="fas fa-check-circle text-success"></i> Soil moisture is good';
            } else if (moisture >= 20) {
                advice = '<i class="fas fa-exclamation-triangle text-warning"></i> Irrigation recommended';
            } else {
                advice = '<i class="fas fa-exclamation-triangle text-danger"></i> Irrigate immediately';
            }
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
                            <i class="fas fa-leaf" style="margin-right: 8px;"></i>
                            ${plotName}
                        </h6>
                        <span class="badge ${statusClass}" style="box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${statusBadge}</span>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="text-muted small fw-semibold" style="color: #546E7A;">Moisture Level</span>
                                ${isValid ? 
                                    `<span class="fw-bold" style="font-size: 1.3rem; background: linear-gradient(135deg, #2E7D32, #66BB6A); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${plot.current_moisture}%</span>` :
                                    `<span class="fw-bold text-muted" style="font-size: 1rem;">No Data</span>`
                                }
                            </div>
                            ${isValid ? 
                                `<div class="progress" style="height: 12px; border-radius: 10px;">
                                    <div class="progress-bar ${statusClass} progress-bar-animated" role="progressbar" 
                                         style="width: 0%; transition: width 1s ease;" 
                                         data-target="${plot.current_moisture}"
                                         aria-valuenow="0" 
                                         aria-valuemin="0" 
                                         aria-valuemax="100"></div>
                                </div>` :
                                `<div class="alert alert-secondary mb-0 py-2" style="font-size: 0.85rem;">
                                    <i class="fas fa-unlink"></i> Sensor not connected
                                </div>`
                            }
                        </div>
                        <div class="mb-3 p-2" style="background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 10px;">
                            <small class="d-flex align-items-center mb-2" style="color: #546E7A;">
                                <i class="fas fa-microchip" style="color: #2E7D32; margin-right: 8px; font-size: 1rem;"></i>
                                <span class="fw-semibold">${plot.sensor_id}</span>
                            </small>
                            <small class="d-flex align-items-center" style="color: #546E7A;">
                                <i class="fas fa-map-marker-alt" style="color: #F9A825; margin-right: 8px; font-size: 1rem;"></i>
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
            return data.data; // Return the sensor data so it can be reused
        }
        return null;
    } catch (error) {
        console.error('Error loading sensor data:', error);
        return null;
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
                        text: 'Moisture Level (%)',
                        color: '#2E7D32',
                        font: {
                            size: 12,
                            weight: 600
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#2E7D32',
                        font: {
                            size: 12,
                            weight: 600
                        },
                        padding: {
                            top: 15
                        }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15,
                        font: {
                            size: 10
                        },
                        padding: 5
                    }
                }
            },
            layout: {
                padding: {
                    bottom: 20
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
function renderPlotMap(lat, lng, plotSize = 2.5, plotName = 'Plot', numberOfSensors = 1, moistureLevel = null, irrigationStatus = null) {
    // Show the map section
    const mapSection = document.getElementById('plot-map-section');
    mapSection.style.display = 'block';
    
    // Remove existing map if any
    if (currentPlotMap) {
        currentPlotMap.remove();
    }
    
    // Initialize Leaflet map with zoom control position
    currentPlotMap = L.map('plot-map', {
        zoomControl: false
    }).setView([lat, lng], 15);
    
    // Add zoom control to top right
    L.control.zoom({
        position: 'topright'
    }).addTo(currentPlotMap);
    
    // Base layers for layer switcher
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    });
    
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    });
    
    const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenTopoMap',
        maxZoom: 17
    });
    
    // Add default layer
    osmLayer.addTo(currentPlotMap);
    
    // Add layer control
    const baseLayers = {
        "Street": osmLayer,
        "Satellite": satelliteLayer,
        "Terrain": terrainLayer
    };
    L.control.layers(baseLayers).addTo(currentPlotMap);
    
    // Add fullscreen control
    currentPlotMap.addControl(new (L.Control.extend({
        options: { position: 'topright' },
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.innerHTML = '<a href="#" title="Toggle Fullscreen" style="width: 30px; height: 30px; line-height: 30px; display: block; text-align: center; text-decoration: none; color: #000; background: white;"><i class="fas fa-expand"></i></a>';
            container.onclick = function(e) {
                e.preventDefault();
                const mapContainer = document.getElementById('plot-map');
                if (!document.fullscreenElement) {
                    mapContainer.requestFullscreen();
                    container.querySelector('i').className = 'fas fa-compress';
                } else {
                    document.exitFullscreen();
                    container.querySelector('i').className = 'fas fa-expand';
                }
            };
            return container;
        }
    }))());
    
    // Calculate plot area visualization as a rectangle
    // 1 acre = 4046.86 square meters
    const areaInSquareMeters = plotSize * 4046.86;
    
    // Use 3:4 ratio (width:length) typical for agricultural fields
    const width = Math.sqrt(areaInSquareMeters * 3 / 4);
    const length = width * 4 / 3;
    
    // Calculate corner coordinates
    const latOffset = (length / 2) / 111320;
    const lngOffset = (width / 2) / (111320 * Math.cos(lat * Math.PI / 180));
    
    const bounds = [
        [lat - latOffset, lng - lngOffset],
        [lat + latOffset, lng + lngOffset]
    ];
    
    // Determine color based on moisture level
    let plotColor = '#6c757d'; // Default gray
    let statusText = 'Unknown';
    let statusIcon = 'question-circle';
    
    if (moistureLevel !== null) {
        if (moistureLevel >= 40) {
            plotColor = '#28a745'; // Green - Good
            statusText = 'Good';
            statusIcon = 'check-circle';
        } else if (moistureLevel >= 20) {
            plotColor = '#ffc107'; // Yellow - Low
            statusText = 'Low';
            statusIcon = 'exclamation-triangle';
        } else {
            plotColor = '#dc3545'; // Red - Critical
            statusText = 'Critical';
            statusIcon = 'exclamation-circle';
        }
    }
    
    // Add rectangle with dynamic coloring
    const plotRectangle = L.rectangle(bounds, {
        color: plotColor,
        fillColor: plotColor,
        fillOpacity: 0.3,
        weight: 3
    }).addTo(currentPlotMap);
    
    // Enhanced popup content
    let popupContent = `<div style="min-width: 200px;">
        <h6 style="margin: 0 0 10px 0; color: ${plotColor};"><i class="fas fa-map-marker-alt"></i> ${plotName}</h6>
        <hr style="margin: 10px 0;">
        <div style="font-size: 13px;">
            <p style="margin: 5px 0;"><i class="fas fa-ruler-combined"></i> <strong>Size:</strong> ${plotSize} acres</p>
            <p style="margin: 5px 0;"><i class="fas fa-broadcast-tower"></i> <strong>Sensors:</strong> ${numberOfSensors}</p>`;
    
    if (moistureLevel !== null) {
        popupContent += `
            <p style="margin: 5px 0;"><i class="fas fa-tint"></i> <strong>Moisture:</strong> ${moistureLevel}%</p>
            <p style="margin: 5px 0;"><i class="fas fa-${statusIcon}" style="color: ${plotColor};"></i> <strong>Status:</strong> <span style="color: ${plotColor}; font-weight: bold;">${statusText}</span></p>`;
    }
    
    if (irrigationStatus) {
        popupContent += `<p style="margin: 5px 0;"><i class="fas fa-info-circle"></i> ${irrigationStatus}</p>`;
    }
    
    popupContent += `</div></div>`;
    
    plotRectangle.bindPopup(popupContent);
    
    // Add center marker with matching color
    const markerIcon = L.icon({
        iconUrl: moistureLevel >= 40 ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' :
                 moistureLevel >= 20 ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png' :
                 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    L.marker([lat, lng], { icon: markerIcon })
        .addTo(currentPlotMap)
        .bindPopup(popupContent)
        .openPopup();
    
    // Add "Zoom to Fit" button
    currentPlotMap.addControl(new (L.Control.extend({
        options: { position: 'topright' },
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.innerHTML = '<a href="#" title="Zoom to Fit Plot" style="width: 30px; height: 30px; line-height: 30px; display: block; text-align: center; text-decoration: none; color: #000; background: white;"><i class="fas fa-compress-arrows-alt"></i></a>';
            container.onclick = function(e) {
                e.preventDefault();
                currentPlotMap.fitBounds(bounds, { padding: [50, 50] });
            };
            return container;
        }
    }))());
}

// View Plot - Load all plot details
async function viewPlot(plotId, sensorId) {
    // Load sensor data and capture the returned data
    const sensorData = await loadSensorData(sensorId);
    
    // Load smart irrigation advice
    await loadSmartAdvice(plotId);
    
    // Find the plot to get its coordinates and size
    const plot = currentPlots.find(p => p._id === plotId);
    if (plot && plot.location) {
        // Parse location "lat, lng"
        const coords = plot.location.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            const plotSize = plot.size_acres || 2.5;
            const plotName = plot.name || 'Plot';
            const numberOfSensors = plot.number_of_sensors || 1;
            
            // Get latest moisture from loaded sensor data
            let moistureLevel = null;
            let irrigationStatus = null;
            
            if (sensorData && sensorData.length > 0) {
                moistureLevel = sensorData[0].moisture_value;
                
                // Determine irrigation status
                if (moistureLevel >= 40) {
                    irrigationStatus = 'No irrigation needed';
                } else if (moistureLevel >= 20) {
                    irrigationStatus = 'Consider irrigating soon';
                } else {
                    irrigationStatus = 'Immediate irrigation required!';
                }
            }
            
            renderPlotMap(coords[0], coords[1], plotSize, plotName, numberOfSensors, moistureLevel, irrigationStatus);
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

// Real-time WebSocket integration
if (window.RealtimeService) {
    // Listen for real-time sensor data updates
    window.RealtimeService.onEvent('sensorData', (data) => {
        console.log('Real-time sensor update:', data);
        
        // Update plot cards with new moisture value
        const plotCard = document.querySelector(`[data-sensor-id="${data.sensorId}"]`);
        if (plotCard) {
            const moistureElement = plotCard.querySelector('.moisture-value');
            const moistureBar = plotCard.querySelector('.moisture-progress');
            
            if (moistureElement) {
                moistureElement.textContent = `${data.moisture.toFixed(1)}%`;
            }
            
            if (moistureBar) {
                moistureBar.style.width = `${data.moisture}%`;
                
                // Update color based on moisture level (aligned with irrigation logic)
                moistureBar.classList.remove('bg-success', 'bg-info', 'bg-warning', 'bg-danger');
                if (data.moisture >= 40) {
                    moistureBar.classList.add('bg-success');
                } else if (data.moisture >= 20) {
                    moistureBar.classList.add('bg-warning');
                } else {
                    moistureBar.classList.add('bg-danger');
                }
            }
        }
        
        // Update chart if it's the currently displayed sensor
        if (moistureChart && currentPlots.length > 0) {
            const currentPlot = currentPlots.find(p => p.sensor_id === data.sensorId);
            if (currentPlot) {
                // Add new data point to chart
                const now = new Date();
                moistureChart.data.labels.push(now.toLocaleTimeString());
                moistureChart.data.datasets[0].data.push(data.moisture);
                
                // Keep only last 20 data points
                if (moistureChart.data.labels.length > 20) {
                    moistureChart.data.labels.shift();
                    moistureChart.data.datasets[0].data.shift();
                }
                
                moistureChart.update('none'); // Update without animation for smooth feel
            }
        }
    });
    
    // Listen for critical alerts
    window.RealtimeService.onEvent('criticalAlert', (alert) => {
        console.log('Critical alert received:', alert);
        
        // Flash the affected plot card
        const plotCard = document.querySelector(`[data-plot-id="${alert.plotId}"]`);
        if (plotCard) {
            plotCard.classList.add('border-danger');
            plotCard.style.animation = 'pulse 1s ease-in-out 3';
            
            setTimeout(() => {
                plotCard.classList.remove('border-danger');
                plotCard.style.animation = '';
            }, 3000);
        }
        
        // Show toast notification
        if (window.toast) {
            const message = alert.level === 'low' 
                ? `${alert.plotName}: Moisture too low (${alert.moisture}%) - Irrigation needed!`
                : `${alert.plotName}: Moisture too high (${alert.moisture}%) - Check drainage!`;
            window.toast.warning(message);
        }
    });
    
    // Listen for device status changes
    window.RealtimeService.onEvent('deviceStatus', (status) => {
        console.log('Device status update:', status);
        
        const plotCard = document.querySelector(`[data-sensor-id="${status.deviceId}"]`);
        if (plotCard) {
            const statusBadge = plotCard.querySelector('.device-status-badge');
            if (statusBadge) {
                if (status.online) {
                    statusBadge.innerHTML = '<i class="fas fa-circle text-success"></i> Online';
                    statusBadge.classList.remove('text-danger');
                    statusBadge.classList.add('text-success');
                } else {
                    statusBadge.innerHTML = '<i class="fas fa-circle text-danger"></i> Offline';
                    statusBadge.classList.remove('text-success');
                    statusBadge.classList.add('text-danger');
                }
            }
        }
    });
    
    console.log('Real-time updates enabled for farmer dashboard');
}

// Add Plot functionality with inline form (no modals)
const addBtn = document.getElementById('dashboardAddPlotBtn');
const addPlotFormContainer = document.getElementById('addPlotFormContainer');
const cancelAddPlotBtn = document.getElementById('cancelAddPlot');
const numSensorsInput = document.getElementById('numSensors');
const sensorIdsContainer = document.getElementById('sensorIdsContainer');
const useLocationBtn = document.getElementById('useLocationBtn');
const plotLatInput = document.getElementById('plotLat');
const plotLngInput = document.getElementById('plotLng');

if (addBtn) {
    addBtn.addEventListener('click', () => {
        // Toggle form visibility
        if (addPlotFormContainer.style.display === 'none') {
            addPlotFormContainer.style.display = 'block';
            addBtn.innerHTML = '<i class="fas fa-times"></i> Close Form';
            addBtn.classList.remove('btn-success');
            addBtn.classList.add('btn-secondary');
            // Scroll to form
            addPlotFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            addPlotFormContainer.style.display = 'none';
            addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Plot';
            addBtn.classList.remove('btn-secondary');
            addBtn.classList.add('btn-success');
            // Reset form
            document.getElementById('addPlotForm').reset();
            sensorIdsContainer.style.display = 'none';
            sensorIdsContainer.innerHTML = '';
        }
    });
}

// Cancel button handler
if (cancelAddPlotBtn) {
    cancelAddPlotBtn.addEventListener('click', () => {
        addPlotFormContainer.style.display = 'none';
        addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Plot';
        addBtn.classList.remove('btn-secondary');
        addBtn.classList.add('btn-success');
        document.getElementById('addPlotForm').reset();
        sensorIdsContainer.style.display = 'none';
        sensorIdsContainer.innerHTML = '';
    });
}

// Number of sensors input handler - generate sensor ID inputs
if (numSensorsInput) {
    numSensorsInput.addEventListener('input', () => {
        const numSensors = parseInt(numSensorsInput.value) || 0;
        
        if (numSensors > 0) {
            sensorIdsContainer.style.display = 'block';
            sensorIdsContainer.innerHTML = '<div class="row g-3">';
            
            for (let i = 1; i <= numSensors; i++) {
                sensorIdsContainer.innerHTML += `
                    <div class="col-md-6">
                        <label for="sensorId${i}" class="form-label">Sensor ID ${i} <span class="text-danger">*</span></label>
                        <input type="text" class="form-control sensor-id-input" id="sensorId${i}" 
                               placeholder="e.g., PICO_0${i}" style="text-transform: uppercase;" required>
                    </div>
                `;
            }
            
            sensorIdsContainer.innerHTML += '</div>';
        } else {
            sensorIdsContainer.style.display = 'none';
            sensorIdsContainer.innerHTML = '';
        }
    });
}

// Use Location button handler
if (useLocationBtn) {
    useLocationBtn.addEventListener('click', () => {
        useLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting your location...';
        useLocationBtn.disabled = true;
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    plotLatInput.value = position.coords.latitude.toFixed(6);
                    plotLngInput.value = position.coords.longitude.toFixed(6);
                    useLocationBtn.innerHTML = '<i class="fas fa-check-circle"></i> Location Set!';
                    useLocationBtn.classList.remove('btn-primary');
                    useLocationBtn.classList.add('btn-success');
                    
                    if (window.toast) {
                        window.toast.success('Location detected successfully!');
                    }
                    
                    setTimeout(() => {
                        useLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                        useLocationBtn.classList.remove('btn-success');
                        useLocationBtn.classList.add('btn-primary');
                        useLocationBtn.disabled = false;
                    }, 2000);
                },
                (error) => {
                    useLocationBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Location Access Denied';
                    useLocationBtn.classList.remove('btn-primary');
                    useLocationBtn.classList.add('btn-danger');
                    
                    if (window.toast) {
                        window.toast.error('Please enable location access in your browser');
                    }
                    
                    setTimeout(() => {
                        useLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                        useLocationBtn.classList.remove('btn-danger');
                        useLocationBtn.classList.add('btn-primary');
                        useLocationBtn.disabled = false;
                    }, 3000);
                }
            );
        } else {
            useLocationBtn.innerHTML = '<i class="fas fa-times-circle"></i> Location Not Supported';
            useLocationBtn.classList.remove('btn-primary');
            useLocationBtn.classList.add('btn-danger');
            
            if (window.toast) {
                window.toast.error('Geolocation is not supported by your browser');
            }
            
            setTimeout(() => {
                useLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                useLocationBtn.classList.remove('btn-danger');
                useLocationBtn.classList.add('btn-primary');
                useLocationBtn.disabled = false;
            }, 3000);
        }
    });
}

// Add plot form submission
const addPlotForm = document.getElementById('addPlotForm');
if (addPlotForm) {
    addPlotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(addPlotForm);
        const plotData = Object.fromEntries(formData.entries());
        
        // Validate required fields
        if (!plotData.name || !plotData.size_acres || !plotData.number_of_sensors || !plotData.latitude || !plotData.longitude) {
            alert('Please fill in all required fields');
            return;
        }
        
        const numSensors = parseInt(plotData.number_of_sensors);
        
        // Collect sensor IDs
        const sensorIds = [];
        for (let i = 1; i <= numSensors; i++) {
            const sensorInput = document.getElementById(`sensorId${i}`);
            const sensorId = sensorInput ? sensorInput.value.trim().toUpperCase() : '';
            
            if (!sensorId) {
                alert(`Please enter Sensor ID ${i}`);
                return;
            }
            
            sensorIds.push(sensorId);
        }
        
        // Check for duplicate sensor IDs
        const uniqueSensorIds = new Set(sensorIds);
        if (uniqueSensorIds.size !== sensorIds.length) {
            alert('Sensor IDs must be unique');
            return;
        }
        
        // Prepare plot data
        const plotPayload = {
            name: plotData.name,
            crop_type: plotData.crop_type,
            sensor_id: sensorIds[0], // Primary sensor
            sensor_ids: sensorIds,
            size_acres: parseFloat(plotData.size_acres),
            number_of_sensors: numSensors,
            location: {
                lat: parseFloat(plotData.latitude),
                lng: parseFloat(plotData.longitude)
            }
        };
        
        // Show loading state
        const submitBtn = document.getElementById('submitAddPlot');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE_URL}/plots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(plotPayload)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create plot');
            }
            
            // Success!
            alert(`Plot "${plotData.name}" created successfully!`);
            
            // Hide form
            addPlotFormContainer.style.display = 'none';
            addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Plot';
            addBtn.classList.remove('btn-secondary');
            addBtn.classList.add('btn-success');
            
            // Reset form
            addPlotForm.reset();
            sensorIdsContainer.style.display = 'none';
            sensorIdsContainer.innerHTML = '';
            
            // Reload plots
            await fetchFarmerStats();
            
        } catch (error) {
            console.error('Error creating plot:', error);
            alert(`Error: ${error.message}`);
        } finally {
            // Restore button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// Initialize the dashboard
fetchFarmerStats();
