import { API_BASE_URL } from '../../shared/js/api.js';
import { getToken } from '../../shared/js/auth.js';
import { initAdminPage } from './common.js';

// Initialize admin page (handles auth, UI, sidebar)
const user = initAdminPage();
if (!user) {
    // initAdminPage handles redirect if auth fails
    throw new Error('Authentication failed');
}

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
            console.log('Loaded users from API:', allUsers.length, 'total users');
            console.log('Farmers:', allUsers.filter(u => u.role === 'farmer').length);
            displayUsersTable(allUsers);
            updateDashboardStats();
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        console.log('Using sample data instead');
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
        
        // Determine marker color based on moisture level (aligned with irrigation logic)
        const moisture = plot.current_moisture || 0;
        let markerColor;
        if (moisture === null || moisture === undefined) {
            markerColor = '#6c757d'; // Grey for no data
        } else if (moisture >= 40) {
            markerColor = '#28a745'; // Green for good
        } else if (moisture >= 20) {
            markerColor = '#ffc107'; // Yellow for low
        } else {
            markerColor = '#dc3545'; // Red for critical
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
        
        // Determine status based on moisture level (aligned with irrigation logic)
        let status, statusColor, statusBadge;
        if (moisture === null || moisture === undefined) {
            status = 'No Data';
            statusColor = '#6c757d';
            statusBadge = 'secondary';
        } else if (moisture >= 40) {
            status = 'Good';
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
        // Find the plot details from allPlots
        const plot = allPlots.find(p => p._id === plotId);
        
        if (!plot) {
            Swal.fire({
                icon: 'error',
                title: 'Plot Not Found',
                text: 'Could not find plot details'
            });
            return;
        }

        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/dashboard/sensor-data/${sensorId}?limit=5`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const moisture = plot.current_moisture || 0;
            const farmerName = plot.farmer_id?.username || 'N/A';
            const lastUpdate = plot.last_update ? new Date(plot.last_update).toLocaleString() : 'N/A';
            
            // Determine status
            let status, statusColor;
            if (moisture >= 40) {
                status = 'Good';
                statusColor = '#28a745';
            } else if (moisture >= 20) {
                status = 'Low';
                statusColor = '#ffc107';
            } else {
                status = 'Critical';
                statusColor = '#dc3545';
            }
            
            // Build recent readings HTML
            const readingsHtml = data.data.length > 0 
                ? data.data.map(d => 
                    `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <span class="text-muted small">${new Date(d.timestamp).toLocaleString()}</span>
                        <span class="badge bg-primary">${d.moisture_value}%</span>
                    </div>`
                ).join('')
                : '<p class="text-muted text-center">No recent readings available</p>';
            
            Swal.fire({
                title: `<i class="fas fa-seedling"></i> ${plot.name}`,
                html: `
                    <div class="text-start">
                        <div class="row g-3 mb-3">
                            <div class="col-6">
                                <p class="mb-1"><strong>Farmer:</strong></p>
                                <p class="text-muted">${farmerName}</p>
                            </div>
                            <div class="col-6">
                                <p class="mb-1"><strong>Sensor ID:</strong></p>
                                <p class="text-muted"><code>${sensorId}</code></p>
                            </div>
                            <div class="col-6">
                                <p class="mb-1"><strong>Location:</strong></p>
                                <p class="text-muted small">${plot.location}</p>
                            </div>
                            <div class="col-6">
                                <p class="mb-1"><strong>Last Update:</strong></p>
                                <p class="text-muted small">${lastUpdate}</p>
                            </div>
                            <div class="col-12">
                                <p class="mb-1"><strong>Current Moisture:</strong></p>
                                <h3 style="color: ${statusColor}">${moisture}% - ${status}</h3>
                            </div>
                        </div>
                        
                        <hr>
                        
                        <h6 class="mb-3"><i class="fas fa-chart-line"></i> Recent Readings</h6>
                        <div class="mb-2" style="max-height: 200px; overflow-y: auto;">
                            ${readingsHtml}
                        </div>
                    </div>
                `,
                width: '600px',
                confirmButtonText: '<i class="fas fa-times"></i> Close',
                confirmButtonColor: '#6c757d'
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'No Data Available',
                text: 'No sensor data found for this plot'
            });
        }
    } catch (error) {
        console.error('Error loading plot details:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load plot details'
        });
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
    
    // Skip if element doesn't exist (e.g., on dashboard page without user table)
    if (!tbody) {
        return;
    }
    
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
const addUserFormContainer = document.getElementById('addUserFormContainer');
const cancelAddUserBtn = document.getElementById('cancelAddUser');

if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
        // Toggle form visibility
        if (addUserFormContainer.style.display === 'none') {
            addUserFormContainer.style.display = 'block';
            addUserBtn.innerHTML = '<i class="fas fa-times"></i> Close Form';
            addUserBtn.classList.remove('btn-success');
            addUserBtn.classList.add('btn-secondary');
            // Scroll to form
            addUserFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            addUserFormContainer.style.display = 'none';
            addUserBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add User';
            addUserBtn.classList.remove('btn-secondary');
            addUserBtn.classList.add('btn-success');
            // Reset form
            document.getElementById('addUserForm').reset();
        }
    });
}

// Cancel button handler
if (cancelAddUserBtn) {
    cancelAddUserBtn.addEventListener('click', () => {
        addUserFormContainer.style.display = 'none';
        addUserBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add User';
        addUserBtn.classList.remove('btn-secondary');
        addUserBtn.classList.add('btn-success');
        document.getElementById('addUserForm').reset();
    });
}

// Add user form submission
const addUserForm = document.getElementById('addUserForm');
if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(addUserForm);
        const userData = Object.fromEntries(formData.entries());
        
        // Validate password match
        if (userData.password !== userData.confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        
        // Remove confirmPassword before sending to API
        delete userData.confirmPassword;
        
        // Show loading state
        const submitBtn = document.getElementById('submitAddUser');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            const token = getToken();
            
            // Determine which endpoint to use based on role
            const endpoint = userData.role === 'admin' 
                ? `${API_BASE_URL}/auth/register/admin`
                : `${API_BASE_URL}/auth/register`;
            
            // For admin registration, need admin secret
            if (userData.role === 'admin') {
                const adminSecret = prompt('Enter admin secret key to create admin user:');
                if (!adminSecret) {
                    throw new Error('Admin secret key is required');
                }
                userData.adminSecret = adminSecret;
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create user');
            }
            
            // Success!
            alert(`User "${userData.username}" created successfully!`);
            
            // Hide form
            addUserFormContainer.style.display = 'none';
            addUserBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add User';
            addUserBtn.classList.remove('btn-secondary');
            addUserBtn.classList.add('btn-success');
            
            // Reset form
            addUserForm.reset();
            
            // Reload users list
            await fetchUsers();
            
        } catch (error) {
            console.error('Error creating user:', error);
            alert(`Error: ${error.message}`);
        } finally {
            // Restore button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// ================================
// SIDEBAR TOGGLE FOR MOBILE
// ================================
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.querySelector('.sidebar');

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        
        // If sidebar is active (shown), add overlay
        if (sidebar.classList.contains('active')) {
            // Create overlay if doesn't exist
            if (!document.querySelector('.sidebar-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('active');
                    overlay.remove();
                });
                document.body.appendChild(overlay);
            }
        } else {
            // Remove overlay
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.remove();
        }
    });
}

// ================================
// HIGHLIGHT ACTIVE NAV LINK
// ================================
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}

// Call on page load
setActiveNavLink();

// Initialize admin dashboard
initMap();
fetchUsers();
fetchPlots();
