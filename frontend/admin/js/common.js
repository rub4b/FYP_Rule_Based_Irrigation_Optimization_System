// admin-common.js - Centralized admin utilities
import { getCurrentUser, logout, getToken } from '../../shared/js/auth.js';

/**
 * Initialize admin page with authentication, UI setup, and sidebar
 * Call this at the top of every admin page
 * @returns {Object|null} Current user object or null if auth failed
 */
export function initAdminPage() {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = '../auth/index.html';
        return null;
    }
    
    if (user.role !== 'admin') {
        alert('Access denied. Admin only.');
        window.location.href = '../farmer/dashboard.html';
        return null;
    }
    
    // Setup username display
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.innerHTML = `<i class="fas fa-user-shield"></i> ${user.username}`;
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Setup sidebar toggle for mobile
    initSidebarToggle();
    
    return user;
}

/**
 * Initialize sidebar toggle functionality for mobile responsive design
 * Handles sidebar show/hide and overlay
 */
export function initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            
            // If sidebar is active (shown), add overlay
            if (sidebar.classList.contains('active')) {
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
                // Remove overlay when sidebar is hidden
                document.querySelector('.sidebar-overlay')?.remove();
            }
        });
    }
}

/**
 * Initialize farmer page with authentication and UI setup
 * @returns {Object|null} Current user object or null if auth failed
 */
export function initFarmerPage() {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    
    if (user.role !== 'farmer') {
        alert('Access denied. Farmer only.');
        window.location.href = 'dashboard.html';
        return null;
    }
    
    // Setup username display
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${user.username}`;
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    return user;
}

/**
 * Get auth token for API requests
 * @returns {string|null} JWT token or null
 */
export function getAuthToken() {
    return getToken();
}

/**
 * Setup authenticated fetch with auto token injection
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
    const token = getToken();
    
    if (!token) {
        window.location.href = '../auth/index.html';
        return null;
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    
    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        }
    };
    
    return fetch(url, config);
}
