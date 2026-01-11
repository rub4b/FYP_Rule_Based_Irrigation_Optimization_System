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

/**
 * Fetches and populates admin profile information
 */
async function loadAdminProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
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
        const user = data.user || data;
        
        // Populate identity card
        populateIdentityCard(user);
        
        // Populate form fields
        populateFormFields(user);
        
    } catch (error) {
        console.error('Error loading admin profile:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load admin profile information',
            confirmButtonColor: '#2E7D32'
        });
    }
}

/**
 * Populates the admin identity card
 * @param {Object} user - User data object
 */
function populateIdentityCard(user) {
    // Set admin name
    const adminNameDisplay = document.getElementById('admin-name-display');
    if (adminNameDisplay) {
        adminNameDisplay.textContent = user.username || user.name || 'Admin';
    }
    
    // Set joined year
    const joinedYear = document.getElementById('joined-year');
    if (joinedYear && user.createdAt) {
        const year = new Date(user.createdAt).getFullYear();
        joinedYear.textContent = year;
    }
}

/**
 * Populates form fields with user data
 * @param {Object} user - User data object
 */
function populateFormFields(user) {
    // Username
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.value = user.username || '';
    }
    
    // Email
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.value = user.email || '';
    }
    
    // Notification Email (if exists)
    const notificationEmailInput = document.getElementById('notification_email');
    if (notificationEmailInput) {
        notificationEmailInput.value = user.notification_email || user.email || '';
    }
}

/**
 * Handles form submission
 */
document.getElementById('adminSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const notificationEmail = document.getElementById('notification_email').value.trim();
    const currentPassword = document.getElementById('current_password').value;
    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    
    // Validate email
    if (!email || !email.includes('@')) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid Email',
            text: 'Please enter a valid email address',
            confirmButtonColor: '#2E7D32'
        });
        return;
    }
    
    // Validate password change if fields are filled
    if (newPassword || confirmPassword) {
        if (!currentPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Current Password Required',
                text: 'Please enter your current password to change it',
                confirmButtonColor: '#2E7D32'
            });
            return;
        }
        
        if (newPassword !== confirmPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Passwords Do Not Match',
                text: 'New password and confirmation do not match',
                confirmButtonColor: '#2E7D32'
            });
            return;
        }
        
        if (newPassword.length < 6) {
            Swal.fire({
                icon: 'error',
                title: 'Weak Password',
                text: 'Password must be at least 6 characters long',
                confirmButtonColor: '#2E7D32'
            });
            return;
        }
    }
    
    // Prepare update data
    const updateData = {
        username,
        email,
        notification_email: notificationEmail
    };
    
    // Add password fields if changing password
    if (newPassword) {
        updateData.current_password = currentPassword;
        updateData.new_password = newPassword;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update profile');
        }

        const data = await response.json();
        
        // Update localStorage if username changed
        if (data.user && data.user.username) {
            localStorage.setItem('username', data.user.username);
        }
        
        // Clear password fields
        document.getElementById('current_password').value = '';
        document.getElementById('new_password').value = '';
        document.getElementById('confirm_password').value = '';
        
        // Show success message
        Swal.fire({
            icon: 'success',
            title: 'Settings Updated!',
            text: 'Your admin settings have been saved successfully',
            confirmButtonColor: '#2E7D32'
        }).then(() => {
            // Reload profile data
            loadAdminProfile();
        });
        
    } catch (error) {
        console.error('Error updating admin settings:', error);
        Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error.message || 'Failed to update settings. Please try again.',
            confirmButtonColor: '#2E7D32'
        });
    }
});

// Initial load
loadAdminProfile();
