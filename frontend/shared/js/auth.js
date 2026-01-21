import { API_BASE_URL } from './api.js';

// Login function
export async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        if (data.success) {
            // Save JWT token and user info to localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect based on role
            if (data.user.role === 'admin') {
                window.location.href = '../admin/dashboard.html';
            } else {
                window.location.href = '../farmer/dashboard.html';
            }
        }

        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Check authentication
export function checkAuth() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (!token || !user) {
        // No token found, redirect to login
        // Determine path based on current location
        const currentPath = window.location.pathname;
        if (currentPath.includes('/auth/')) {
            window.location.href = 'index.html';
        } else {
            window.location.href = '../auth/index.html';
        }
        return null;
    }

    try {
        return JSON.parse(user);
    } catch (error) {
        console.error('Invalid user data in localStorage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const currentPath = window.location.pathname;
        if (currentPath.includes('/auth/')) {
            window.location.href = 'index.html';
        } else {
            window.location.href = '../auth/index.html';
        }
        return null;
    }
}

// Logout function
export function logout() {
    // Clear both storages
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    
    const currentPath = window.location.pathname;
    if (currentPath.includes('/auth/')) {
        window.location.href = 'index.html';
    } else {
        window.location.href = '../auth/index.html';
    }
}

// Get current user
export function getCurrentUser() {
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (user) {
        try {
            return JSON.parse(user);
        } catch (error) {
            console.error('Invalid user data');
            return null;
        }
    }
    return null;
}

// Get auth token
export function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}
