import { API_BASE_URL } from './api.js';
import { getCurrentUser, logout, getToken, checkAuth } from './auth.js';

// Check authentication and admin role
const user = getCurrentUser();
if (!user) {
    window.location.href = 'index.html';
}

if (user.role !== 'admin') {
    alert('Access denied. Admin only.');
    window.location.href = 'farmer.html';
}

// Display username
document.getElementById('username-display').textContent = `Admin: ${user.username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', logout);

let map = null;
let markers = [];
let allUsers = [];
let allPlots = [];

// Initialize Leaflet map
function initMap() {
    // Create map centered on Malaysia (matching admin-map.js)
    map = L.map('map').setView([3.1390, 101.6869], 6);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
}

// Fetch all users
async function fetchUsers() {
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/auth/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success && data.users) {
            allUsers = data.users;
            displayUsersTable(allUsers);
            updateDashboardStats();
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        // Display sample data if API endpoint doesn't exist yet
        displaySampleUsers();
    }
}

// Fetch all plots (using admin endpoint)
async function fetchPlots() {
    try {
        const token = getToken();
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
        allPlots = data.plots || [];
        
        displayPlotsOnMap(allPlots);
        displayPlotsTable(allPlots);
        updateDashboardStats();
        
    } catch (error) {
        console.error('Error fetching plots:', error);
    }
}

// Update dashboard statistics with real counts
function updateDashboardStats() {
    // Total Farmers (count users with role 'farmer')
    const totalFarmers = allUsers.filter(user => user.role === 'farmer').length;
    document.getElementById('total-farmers').textContent = totalFarmers;
    
    // Active Plots (total plots)
    document.getElementById('total-plots').textContent = allPlots.length;
    
    // Critical Alerts (plots with moisture < 20%)
    const criticalAlerts = allPlots.filter(plot => {
        const moisture = plot.current_moisture;
        return moisture !== null && moisture !== undefined && moisture < 20;
    }).length;
    document.getElementById('active-alerts').textContent = criticalAlerts;
}

function displayPlotsOnMap(plots) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    if (!plots || plots.length === 0) {
        return;
    }
    
    // Parse location and add markers
    plots.forEach((plot, index) => {
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
        
        // Determine marker color based on moisture level (matching admin-map.js logic)
        const moisture = plot.current_moisture || 0;
        let markerColor;
        if (moisture === null || moisture === undefined) {
            markerColor = '#6c757d'; // Grey for no data
        } else if (moisture >= 40) {
            markerColor = '#28a745'; // Green for wet
        } else {
            markerColor = '#dc3545'; // Red for dry
        }
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${markerColor}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [25, 25],
            iconAnchor: [12, 12]
        });
        
        // Determine status text
        let statusText = 'No Data';
        if (moisture !== null && moisture !== undefined) {
            if (moisture >= 40) {
                statusText = 'Healthy';
            } else if (moisture >= 20) {
                statusText = 'Low';
            } else {
                statusText = 'Critical';
            }
        }
        
        // Get farmer name if available
        const farmerName = plot.farmer_id?.username || 'Unknown Farmer';
        
        // Create marker
        const marker = L.marker([lat, lng], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <div style="min-width: 200px; font-family: Poppins, sans-serif;">
                    <h6 style="margin: 0 0 10px 0; color: #2E7D32; font-weight: 600;">${plot.name}</h6>
                    <hr style="margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>Farmer:</strong> ${farmerName}</p>
                    <p style="margin: 5px 0;"><strong>Crop:</strong> ${plot.crop_type || 'Not specified'}</p>
                    <p style="margin: 5px 0;"><strong>Sensor ID:</strong> ${plot.sensor_id || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Moisture:</strong> <span style="color: ${markerColor}; font-weight: bold;">${moisture}%</span></p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> ${statusText}</p>
                    <p style="margin: 5px 0; font-size: 11px; color: #6c757d;">
                        <i class="fas fa-location-arrow"></i> ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </p>
                </div>
            `);
        
        markers.push(marker);
    });
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function displayPlotsTable(plots) {
    const tbody = document.getElementById('plots-table-body');
    
    if (!plots || plots.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No plots found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = plots.map(plot => {
        const moisture = plot.current_moisture || 0;
        
        // Determine status based on moisture level (matching admin-map logic)
        let status, statusColor, statusBadge;
        if (moisture === null || moisture === undefined) {
            status = 'No Data';
            statusColor = '#6c757d';
            statusBadge = 'secondary';
        } else if (moisture >= 40) {
            status = 'Healthy';
            statusColor = '#28a745';
            statusBadge = 'success';
        } else if (moisture >= 20) {
            status = 'Low';
            statusColor = '#ffc107';
            statusBadge = 'warning';
        } else {
            status = 'Critical';
            statusColor = '#dc3545';
            statusBadge = 'danger';
        }
        
        const farmerName = plot.farmer_id?.username || 'N/A';
        
        return `
            <tr>
                <td class="fw-semibold">${plot.name}</td>
                <td>${farmerName}</td>
                <td><code>${plot.sensor_id}</code></td>
                <td><small class="text-muted">${plot.location}</small></td>
                <td><strong>${moisture}%</strong></td>
                <td><span class="badge bg-${statusBadge}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewPlotDetails('${plot._id}', '${plot.sensor_id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Make viewPlotDetails global for onclick handler
window.viewPlotDetails = async function(plotId, sensorId) {
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/dashboard/sensor-data/${sensorId}?limit=20`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Sensor Data for ${sensorId}:\n\nLatest readings:\n` + 
                data.data.slice(0, 5).map(d => 
                    `${new Date(d.timestamp).toLocaleString()}: ${d.moisture_value}%`
                ).join('\n'));
        }
    } catch (error) {
        console.error('Error loading plot details:', error);
        alert('Failed to load plot details');
    }
}

function displaySampleUsers() {
    // Sample data for demonstration
    const sampleUsers = [
        { _id: '1', username: 'John Farmer', email: 'john@farm.com', role: 'farmer', isActive: true },
        { _id: '2', username: 'Jane Smith', email: 'jane@farm.com', role: 'farmer', isActive: true },
        { _id: '3', username: 'Admin User', email: 'admin@aquametic.com', role: 'admin', isActive: true },
        { _id: '4', username: 'Bob Johnson', email: 'bob@farm.com', role: 'farmer', isActive: false }
    ];
    allUsers = sampleUsers;
    displayUsersTable(sampleUsers);
    updateDashboardStats();
}

function displayUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const statusBadge = user.isActive !== false ? 
            '<span class="badge bg-success">Active</span>' : 
            '<span class="badge bg-secondary">Inactive</span>';
        
        const roleBadge = user.role === 'admin' ? 
            '<span class="badge bg-primary"><i class="fas fa-shield-alt"></i> Admin</span>' : 
            '<span class="badge bg-info"><i class="fas fa-user"></i> Farmer</span>';
        
        return `
            <tr>
                <td class="fw-semibold">${user.username}</td>
                <td>${user.email}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-primary btn-sm me-1" onclick="editUser('${user._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${user._id}', '${user.username}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// User action handlers (placeholders for now)
window.editUser = function(userId) {
    alert(`Edit user functionality - User ID: ${userId}\n\nThis feature would open a modal to edit user details.`);
}

window.deleteUser = function(userId, username) {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
        alert(`Delete user functionality - User ID: ${userId}\n\nThis would send a DELETE request to the API.`);
        // In production, you would call the API here
        // await fetch(`${API_BASE_URL}/auth/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
    }
}

// Add user button handler
const addUserBtn = document.getElementById('addUserBtn');
if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
        alert('Add user functionality\n\nThis would open a modal to create a new user account.');
    });
}

// Initialize admin dashboard
initMap();
fetchUsers();
fetchPlots();
