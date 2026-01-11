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
import { getCurrentUser, logout, getToken } from './auth.js';

// Check authentication
const user = getCurrentUser();
if (!user) {
    window.location.href = 'index.html';
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
        const moisture = plot.current_moisture || 0;
        let statusBadge = '';
        let statusClass = '';
        
        if (moisture >= 60) {
            statusBadge = 'Good';
            statusClass = 'bg-success';
        } else if (moisture >= 40) {
            statusBadge = 'Fair';
            statusClass = 'bg-warning';
        } else {
            statusBadge = 'Low';
            statusClass = 'bg-danger';
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
                <div class="card h-100 plot-card card-hover-lift">
                    <div class="card-header d-flex justify-content-between align-items-center animated-gradient">
                        <h6 class="mb-0 fw-bold" style="color: #A5D6A7; font-size: 1.3rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); letter-spacing: 0.5px;">
                            <i class="fas fa-leaf floating-icon" style="margin-right: 8px;"></i>
                            ${plotName}
                        </h6>
                        <span class="badge ${statusClass}" style="box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${statusBadge}</span>
                    </div>
                    <div class="card-body">
                        <div class="mb-3 p-2" style="background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 10px;">
                            <small class="d-flex align-items-center mb-2" style="color: #546E7A;">
                                <i class="fas fa-seedling" style="color: #66BB6A; margin-right: 8px; font-size: 1rem;"></i>
                                <strong>Crop Type:</strong>
                                <span class="ms-2 fw-semibold">${plot.crop_type || 'Not specified'}</span>
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
                                <span class="fw-bold" style="font-size: 1.3rem; background: linear-gradient(135deg, #2E7D32, #66BB6A); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${moisture}%</span>
                            </div>
                            <div class="progress" style="height: 12px; border-radius: 10px;">
                                <div class="progress-bar ${statusClass} progress-bar-animated" role="progressbar" 
                                    style="width: 0%; transition: width 1s ease;" 
                                    data-target="${moisture}"
                                    aria-valuenow="0" 
                                    aria-valuemin="0" 
                                    aria-valuemax="100"></div>
                            </div>
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
    window.location.href = `farmer.html?plotId=${plotId}`;
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
                            <label for="swal-area" class="form-label" style="font-weight: 600; color: #2E7D32;">
                                <i class="fas fa-ruler"></i> Plot Area (hectares)
                            </label>
                            <input id="swal-area" type="number" step="0.01" class="swal2-input" 
                                style="width: 90%; margin: 0.5rem auto;" 
                                placeholder="e.g., 2.5" value="${plot.area || ''}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label" style="font-weight: 600; color: #666;">
                                <i class="fas fa-microchip"></i> Sensor ID
                            </label>
                            <div style="padding: 0.75rem; background: #f5f5f5; border-radius: 5px; color: #666; text-align: center;">
                                ${plot.sensor_id}
                            </div>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-check"></i> Save Changes',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#2E7D32',
                cancelButtonColor: '#6c757d',
                width: '600px',
                preConfirm: () => {
                    const plotName = document.getElementById('swal-plotname').value.trim();
                    const cropType = document.getElementById('swal-croptype').value.trim();
                    const location = document.getElementById('swal-location').value.trim();
                    const area = document.getElementById('swal-area').value;

                    if (!plotName) {
                        Swal.showValidationMessage('Plot name is required');
                        return false;
                    }

                    return {
                        name: plotName,
                        crop_type: cropType,
                        location: location,
                        area: area ? parseFloat(area) : null
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
