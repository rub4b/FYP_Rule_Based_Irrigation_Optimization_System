import { API_BASE_URL } from '../../shared/js/api.js';
import { getCurrentUser, getToken } from '../../shared/js/auth.js';

// Check authentication
const user = getCurrentUser();
const token = getToken();

if (!user || !token || user.role !== 'admin') {
    window.location.href = '../auth/index.html';
}

// Display username
document.getElementById('username-display').innerHTML = `<i class="fas fa-user-shield"></i> ${user.username}`;

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('username');
    window.location.href = '../auth/index.html';
});

// Form elements
const form = document.getElementById('costSettingsForm');
const dieselCostInput = document.getElementById('dieselCost');
const electricityCostInput = document.getElementById('electricityCost');
const pumpPowerInput = document.getElementById('pumpPower');
const laborCostInput = document.getElementById('laborCost');
const resetBtn = document.getElementById('resetBtn');
const dataSourceSpan = document.getElementById('dataSource');

// Current values
let currentValues = {};

/**
 * Load current cost parameters
 */
async function loadCostParameters() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings/cost-parameters`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch cost parameters');
        }

        const data = await response.json();
        currentValues = data.data;

        // Populate form
        dieselCostInput.value = currentValues.dieselCostPerLiter;
        electricityCostInput.value = currentValues.electricityCostPerKwh;
        pumpPowerInput.value = currentValues.pumpPowerKw;
        laborCostInput.value = currentValues.laborCostPerHour;

        // Update source badge
        if (currentValues.source === 'database') {
            dataSourceSpan.className = 'badge bg-success';
            dataSourceSpan.textContent = 'Database (Custom)';
        } else {
            dataSourceSpan.className = 'badge bg-secondary';
            dataSourceSpan.textContent = 'System Defaults';
        }

        if (window.toast) {
            window.toast.success('Cost parameters loaded');
        }
    } catch (error) {
        console.error('Error loading cost parameters:', error);
        Swal.fire({
            icon: 'error',
            title: 'Load Failed',
            text: error.message || 'Failed to load cost parameters',
            confirmButtonColor: '#dc3545'
        });
    }
}

/**
 * Update cost parameters
 */
async function updateCostParameters(e) {
    e.preventDefault();

    const newValues = {
        dieselCostPerLiter: parseFloat(dieselCostInput.value),
        electricityCostPerKwh: parseFloat(electricityCostInput.value),
        pumpPowerKw: parseFloat(pumpPowerInput.value),
        laborCostPerHour: parseFloat(laborCostInput.value)
    };

    // Validation
    if (Object.values(newValues).some(v => isNaN(v) || v < 0)) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid Input',
            text: 'Please enter valid positive numbers for all fields',
            confirmButtonColor: '#dc3545'
        });
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/settings/cost-parameters`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newValues)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to update cost parameters');
        }

        currentValues = data.data;

        Swal.fire({
            icon: 'success',
            title: 'Settings Updated!',
            text: 'Cost parameters have been updated successfully',
            confirmButtonColor: '#2E7D32',
            timer: 2000
        });

        // Update source badge
        dataSourceSpan.className = 'badge bg-success';
        dataSourceSpan.textContent = 'Database (Custom)';
        
    } catch (error) {
        console.error('Error updating cost parameters:', error);
        Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error.message || 'Failed to update cost parameters',
            confirmButtonColor: '#dc3545'
        });
    }
}

/**
 * Reset form to current values
 */
function resetForm() {
    dieselCostInput.value = currentValues.dieselCostPerLiter;
    electricityCostInput.value = currentValues.electricityCostPerKwh;
    pumpPowerInput.value = currentValues.pumpPowerKw;
    laborCostInput.value = currentValues.laborCostPerHour;
    
    if (window.toast) {
        window.toast.info('Form reset to current values');
    }
}

// Event listeners
form.addEventListener('submit', updateCostParameters);
resetBtn.addEventListener('click', resetForm);

// Load on page load
loadCostParameters();
