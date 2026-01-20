// API Configuration
export const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Enhanced API request handler with timeout and error parsing
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default 10000ms)
 */
export async function apiRequest(endpoint, options = {}, timeout = 10000) {
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
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    config.signal = controller.signal;

    try {
        const response = await fetch(url, config);
        clearTimeout(id); // Clear timeout on response

        const data = await response.json();
        
        if (!response.ok) {
            // Handle different error structures
            const errorMessage = data.error || data.message || 'Request failed';
            
            // Handle 401 Unauthorized globally
            if (response.status === 401) {
                // Ideally redirect to login, but keep clean utility
                console.warn('Unauthorized access');
            }
            
            throw new Error(errorMessage);
        }
        
        return data;
    } catch (error) {
        clearTimeout(id);
        console.error('API request error:', error);
        
        // Enhance error message for network issues/timeouts
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection.');
        } else if (error.message === 'Failed to fetch') {
            throw new Error('Network error. Cannot connect to server.');
        }
        
        throw error;
    }
}

// Auth API functions
export async function login(username, password) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: username, password }),
    });
}

export async function register(username, password, role) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
    });
}
