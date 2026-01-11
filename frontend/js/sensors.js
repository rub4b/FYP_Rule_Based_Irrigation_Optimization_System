// --- AUTHENTICATION CHECK ---
const token = localStorage.getItem('token');
if (!token) {
    // No token found? Kick them out!
    window.location.href = 'index.html'; 
}

// --- LOGOUT LOGIC (Copy this too) ---
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
document.getElementById('username-display').innerHTML = `<i class="fas fa-user-circle"></i> ${username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let allSensorLogs = [];
let filteredSensorLogs = []; // Filtered data for display
let selectedSensorFilter = 'all'; // Current filter selection

/**
 * Formats ISO timestamp to readable date
 * @param {string} isoString - ISO timestamp (e.g., "2025-12-19T14:30:00.000Z")
 * @returns {string} - Formatted date (e.g., "Dec 19, 2025")
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Formats ISO timestamp to readable time
 * @param {string} isoString - ISO timestamp
 * @returns {string} - Formatted time (e.g., "2:30 PM")
 */
function formatTime(isoString) {
    const date = new Date(isoString);
    const options = { hour: 'numeric', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-US', options);
}

/**
 * Determines status badge based on moisture value
 * @param {number} moistureValue - Moisture percentage (0-100)
 * @returns {string} - HTML badge element
 */
function getStatusBadge(moistureValue) {
    if (moistureValue < 30) {
        return `<span class="badge bg-danger"><i class="fas fa-exclamation-triangle"></i> Critical</span>`;
    } else {
        return `<span class="badge bg-success"><i class="fas fa-check-circle"></i> Good</span>`;
    }
}

/**
 * Extracts unique sensor IDs and populates the filter dropdown
 */
function populateSensorFilter() {
    const uniqueSensorIds = [...new Set(allSensorLogs.map(log => log.sensor_id || log.sensorId).filter(Boolean))];
    uniqueSensorIds.sort(); // Sort alphabetically
    
    const dropdown = document.getElementById('sensorFilterDropdown');
    
    // Keep "All Sensors" option and add unique sensor IDs
    dropdown.innerHTML = '<option value="all">All Sensors</option>' +
        uniqueSensorIds.map(sensorId => 
            `<option value="${sensorId}">${sensorId}</option>`
        ).join('');
    
    // Restore previous selection if it exists
    dropdown.value = selectedSensorFilter;
}

/**
 * Applies sensor filter to the data
 */
function applyFilter() {
    if (selectedSensorFilter === 'all') {
        filteredSensorLogs = [...allSensorLogs];
    } else {
        filteredSensorLogs = allSensorLogs.filter(log => {
            const sensorId = log.sensor_id || log.sensorId;
            return sensorId === selectedSensorFilter;
        });
    }
    
    // Reset to page 1 when filter changes
    currentPage = 1;
    
    // Update display
    displayCurrentPage();
}

/**
 * Fetches sensor logs from API
 */
async function loadSensorLogs() {
    const tableBody = document.getElementById('sensor-table-body');
    
    // Show loading skeleton
    if (window.SkeletonLoader) {
        window.SkeletonLoader.showSkeletons(tableBody, 5, 'tableRow');
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/sensor/logs`, {
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
        
        // Sort by timestamp descending (newest first)
        allSensorLogs = data.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Populate sensor filter dropdown
        populateSensorFilter();
        
        // Apply current filter
        applyFilter();
        
        // Update total records count (all records, not filtered)
        document.getElementById('total-records').textContent = allSensorLogs.length;
        document.getElementById('total-count').textContent = filteredSensorLogs.length;
        
        if (window.toast) {
            window.toast.success(`Loaded ${allSensorLogs.length} sensor readings`, 2000);
        }
        
    } catch (error) {
        console.error('Error loading sensor logs:', error);
        if (window.toast) {
            window.toast.error('Failed to load sensor data');
        }
        displayErrorMessage();
    }
}

/**
 * Displays sensor logs for the current page
 */
function displayCurrentPage() {
    const tableBody = document.getElementById('sensor-table-body');
    
    // Calculate pagination indices using filtered data
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredSensorLogs.slice(startIndex, endIndex);
    
    // Clear table body
    tableBody.innerHTML = '';
    
    if (pageData.length === 0) {
        displayNoDataMessage();
        return;
    }
    
    // Populate table rows
    pageData.forEach(log => {
        const row = document.createElement('tr');
        
        const date = formatDate(log.timestamp);
        const time = formatTime(log.timestamp);
        const sensorId = log.sensor_id || log.sensorId || 'N/A';
        const moistureValue = log.moisture_value !== undefined ? log.moisture_value : (log.moistureValue || 0);
        const statusBadge = getStatusBadge(moistureValue);
        
        row.innerHTML = `
            <td><i class="fas fa-calendar-alt text-muted"></i> ${date}</td>
            <td><i class="fas fa-clock text-muted"></i> ${time}</td>
            <td><span class="badge bg-secondary">${sensorId}</span></td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="progress flex-grow-1" style="height: 20px; width: 100px;">
                        <div class="progress-bar ${moistureValue < 30 ? 'bg-danger' : 'bg-success'}" 
                             role="progressbar" 
                             style="width: ${moistureValue}%"
                             aria-valuenow="${moistureValue}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                        </div>
                    </div>
                    <span class="fw-semibold">${moistureValue}%</span>
                </div>
            </td>
            <td>${statusBadge}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update pagination info
    updatePaginationControls();
}

/**
 * Updates pagination controls and info
 */
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredSensorLogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredSensorLogs.length);
    
    // Update "Showing X of Y" text
    document.getElementById('showing-count').textContent = filteredSensorLogs.length > 0 ? `${startIndex}-${endIndex}` : '0';
    document.getElementById('total-count').textContent = filteredSensorLogs.length;
    
    // Enable/disable Previous button
    const prevBtn = document.getElementById('prevBtn');
    if (currentPage === 1) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }
    
    // Enable/disable Next button
    const nextBtn = document.getElementById('nextBtn');
    if (currentPage >= totalPages) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
    }
}

/**
 * Displays error message in table
 */
function displayErrorMessage() {
    const tableBody = document.getElementById('sensor-table-body');
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-5">
                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 2rem;"></i>
                <p class="text-danger mt-3 mb-0">Failed to load sensor data</p>
                <p class="text-muted small">Please check your connection and try again</p>
            </td>
        </tr>
    `;
}

/**
 * Displays no data message in table
 */
function displayNoDataMessage() {
    const tableBody = document.getElementById('sensor-table-body');
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-5">
                <i class="fas fa-inbox text-muted" style="font-size: 2rem;"></i>
                <p class="text-muted mt-3 mb-0">No sensor data available</p>
                <p class="text-muted small">Sensor readings will appear here once received</p>
            </td>
        </tr>
    `;
}

/**
 * Pagination: Previous page
 */
document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayCurrentPage();
    }
});

/**
 * Pagination: Next page
 */
document.getElementById('nextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredSensorLogs.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayCurrentPage();
    }
});

/**
 * Sensor filter dropdown change handler
 */
document.getElementById('sensorFilterDropdown').addEventListener('change', (e) => {
    selectedSensorFilter = e.target.value;
    applyFilter();
});

/**
 * Refresh button handler
 */
document.getElementById('refreshBtn').addEventListener('click', async () => {
    const refreshBtn = document.getElementById('refreshBtn');
    const originalHtml = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    refreshBtn.disabled = true;
    
    // Reload data
    await loadSensorLogs();
    
    // Restore button
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
    
    // Show success toast
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Data refreshed',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
});

// Initial load
loadSensorLogs();
