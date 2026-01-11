// --- AUTHENTICATION CHECK ---
const token = localStorage.getItem('token');
if (!token) {
    // No token found? Kick them out!
    window.location.href = 'index.html'; 
}

// --- LOGOUT LOGIC ---
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

import { API_BASE_URL } from './api.js';

// Authentication check
const username = localStorage.getItem('username');

if (!token || !username) {
    window.location.href = 'index.html';
}

// Display username
document.getElementById('username-display').innerHTML = `<i class="fas fa-user-shield"></i> ${username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// Map instance
let map = null;
let markersLayer = null;

/**
 * Initializes the Leaflet map centered on Malaysia
 */
function initializeMap() {
    // Center coordinates for Malaysia (Kuala Lumpur)
    const malaysiaCenter = [3.1390, 101.6869];
    const zoomLevel = 6;
    
    // Initialize map
    map = L.map('admin-large-map').setView(malaysiaCenter, zoomLevel);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Create a feature group for markers (has getBounds() method for auto-zoom)
    markersLayer = L.featureGroup().addTo(map);
}

/**
 * Determines marker color based on moisture level
 * @param {number} moisture - Moisture percentage
 * @returns {string} - Color hex code
 */
function getMarkerColor(moisture) {
    if (moisture === null || moisture === undefined) {
        return '#6c757d'; // Grey for no data
    }
    if (moisture >= 40) {
        return '#28a745'; // Green for wet
    }
    return '#dc3545'; // Red for dry
}

/**
 * Creates a custom colored marker icon
 * @param {string} color - Hex color code
 * @returns {Object} - Leaflet icon object
 */
function createColoredIcon(color) {
    return L.icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="48">
                <path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 0C7.58 0 4 3.58 4 8c0 5.5 8 16 8 16s8-10.5 8-16c0-4.42-3.58-8-8-8z"/>
                <circle cx="12" cy="8" r="3" fill="#fff"/>
            </svg>
        `)}`,
        iconSize: [32, 48],
        iconAnchor: [16, 48],
        popupAnchor: [0, -48]
    });
}

/**
 * Fetches all plots from the API and adds markers to the map
 */
async function loadPlotsOnMap() {
    try {
        // Use admin endpoint - backend reads admin role from JWT token
        const response = await fetch(`${API_BASE_URL}/dashboard/plots`, {
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
        const plots = data.plots || [];
        
        // Update plot count
        document.getElementById('total-plots-count').textContent = plots.length;
        
        // Clear existing markers
        markersLayer.clearLayers();
        
        if (plots.length === 0) {
            // Show toast notification instead of blocking modal
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'No plots in system',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            return;
        }
        
        // Add markers for each plot
        let successfulMarkers = 0;
        plots.forEach(plot => {
            // Parse location string format: "lat, lng"
            let lat, lng;
            
            if (plot.location && typeof plot.location === 'string') {
                const coords = plot.location.split(',').map(c => parseFloat(c.trim()));
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    lat = coords[0];
                    lng = coords[1];
                }
            } else if (plot.latitude && plot.longitude) {
                lat = parseFloat(plot.latitude);
                lng = parseFloat(plot.longitude);
            }
            
            // Skip if coordinates are invalid
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                console.warn(`Invalid coordinates for plot: ${plot.name}`, plot);
                return;
            }
            
            const moisture = plot.current_moisture || 0;
            const markerColor = getMarkerColor(moisture);
            const icon = createColoredIcon(markerColor);
            
            // Determine status text
            let statusText = 'No Data';
            let statusClass = 'secondary';
            if (moisture !== null && moisture !== undefined) {
                if (moisture >= 40) {
                    statusText = 'Healthy';
                    statusClass = 'success';
                } else {
                    statusText = 'Critical';
                    statusClass = 'danger';
                }
            }
            
            // Get farmer name if available
            const farmerName = plot.farmer_id?.username || 'Unknown Farmer';
            
            // Create popup content
            const popupContent = `
                <div style="font-family: Poppins, sans-serif; min-width: 200px;">
                    <h6 style="margin-bottom: 10px; color: #2E7D32; font-weight: 600;">
                        <i class="fas fa-map-marker-alt"></i> ${plot.name}
                    </h6>
                    <hr style="margin: 10px 0;">
                    <p style="margin: 5px 0;">
                        <strong>Farmer:</strong> ${farmerName}
                    </p>
                    <p style="margin: 5px 0;">
                        <strong>Crop:</strong> ${plot.crop_type || 'Not specified'}
                    </p>
                    <p style="margin: 5px 0;">
                        <strong>Sensor:</strong> ${plot.sensor_id || 'N/A'}
                    </p>
                    <p style="margin: 5px 0;">
                        <strong>Moisture:</strong> 
                        <span class="badge bg-${statusClass}">${moisture}%</span>
                    </p>
                    <p style="margin: 5px 0;">
                        <strong>Status:</strong> 
                        <span class="badge bg-${statusClass}">${statusText}</span>
                    </p>
                    <p style="margin: 5px 0; font-size: 11px; color: #6c757d;">
                        <i class="fas fa-location-arrow"></i> ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </p>
                </div>
            `;
            
            // Create marker and add to layer
            const marker = L.marker([lat, lng], { icon: icon })
                .bindPopup(popupContent);
            
            markersLayer.addLayer(marker);
            successfulMarkers++;
        });
        
        // Fit map bounds to show all markers
        if (successfulMarkers > 0) {
            const bounds = markersLayer.getBounds();
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error('Error loading plots on map:', error);
        
        // Show toast notification instead of blocking modal
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Could not load plots',
            text: error.message || 'Unknown error',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
        });
        
        // Add retry button overlay on the map
        const mapContainer = document.getElementById('admin-large-map');
        const existingOverlay = document.getElementById('map-error-overlay');
        
        if (!existingOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'map-error-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1000;
                background: white;
                padding: 20px 30px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                text-align: center;
            `;
            overlay.innerHTML = `
                <i class="fas fa-exclamation-triangle text-warning" style="font-size: 2rem;"></i>
                <p class="mt-3 mb-3">Failed to load plots</p>
                <button class="btn btn-success" onclick="retryLoadPlots()">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            `;
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(overlay);
        }
    }
}

/**
 * Retry loading plots (removes overlay and tries again)
 */
window.retryLoadPlots = function() {
    const overlay = document.getElementById('map-error-overlay');
    if (overlay) {
        overlay.remove();
    }
    loadPlotsOnMap();
};

/**
 * Refresh map button handler
 */
document.getElementById('refreshMapBtn').addEventListener('click', async () => {
    const refreshBtn = document.getElementById('refreshMapBtn');
    const originalHtml = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    refreshBtn.disabled = true;
    
    // Reload data
    await loadPlotsOnMap();
    
    // Restore button
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
    
    // Show success toast
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Map refreshed',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
});

// Initialize map and load plots
initializeMap();
loadPlotsOnMap();
