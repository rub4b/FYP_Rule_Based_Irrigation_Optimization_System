// API Configuration
export const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to make API requests
export async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Add authorization token if available
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// Auth API functions
export async function login(username, password) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function register(username, password, role) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
    });
}

// Dashboard API functions
export async function getPlots(userId, role) {
    return apiRequest(`/dashboard/plots?userId=${userId}&role=${role}`);
}

export async function getPlotById(plotId) {
    return apiRequest(`/dashboard/plot/${plotId}`);
}

export async function getSensorData(sensorId, limit = 100) {
    return apiRequest(`/dashboard/sensor-data/${sensorId}?limit=${limit}`);
}

// Sensor API functions
export async function syncSensorData(sensorId, readings) {
    return apiRequest('/sensor/sync', {
        method: 'POST',
        body: JSON.stringify({ sensor_id: sensorId, readings }),
    });
}
