import { API_BASE_URL } from './api.js';
import { getCurrentUser, logout, getToken } from './auth.js';

// Get current user
const user = getCurrentUser();
if (!user) {
    window.location.href = 'index.html';
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', logout);

// Cancel button handler
const cancelBtn = document.getElementById('cancelBtn');
if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        window.location.href = 'farmer.html';
    });
}

const profileForm = document.getElementById('profileForm');
const profileMessage = document.getElementById('profile-message');
const fullnameInput = document.getElementById('fullname');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const farmNameInput = document.getElementById('farm-name');
const locationInput = document.getElementById('location');
const farmSizeInput = document.getElementById('farm-size');

// Populate user identity card
function populateUserCard(userData) {
    // Set profile name (main display)
    const profileNameDisplay = document.getElementById('profile-name-display');
    if (profileNameDisplay) {
        profileNameDisplay.textContent = userData.name || userData.username || 'User';
    }
    
    // Set joined year
    const joinedYear = document.getElementById('joined-year');
    if (joinedYear && userData.createdAt) {
        const joinDate = new Date(userData.createdAt);
        joinedYear.textContent = joinDate.getFullYear();
    } else if (joinedYear) {
        joinedYear.textContent = '2024';
    }
    
    // Note: Total plots badge will be populated by a separate API call if needed
    // For now it shows 0, can be updated when we fetch user's plots
}

// Populate form fields
function populateFormFields(userData) {
    if (fullnameInput) fullnameInput.value = userData.name || '';
    if (usernameInput) usernameInput.value = userData.username || '';
    if (emailInput) emailInput.value = userData.email || '';
    if (phoneInput) phoneInput.value = userData.phone || '';
    if (farmNameInput) farmNameInput.value = userData.farm_name || '';
    if (locationInput) locationInput.value = userData.location || '';
    if (farmSizeInput) farmSizeInput.value = userData.farm_size || '';
}

// Fetch user profile on load
async function loadUserProfile() {
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch profile');
        }

        if (data.success) {
            // Populate form fields and user card
            populateFormFields(data.user);
            populateUserCard(data.user);
            
            // Show success toast
            if (window.toast) {
                window.toast.success('Profile loaded', 2000);
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        
        // Show error toast
        if (window.toast) {
            window.toast.warning('Failed to load profile data');
        }
        
        // Fallback to local storage data
        if (user) {
            populateFormFields(user);
            populateUserCard(user);
        }
        
        profileMessage.textContent = 'Failed to load profile data';
        profileMessage.className = 'alert alert-warning';
        profileMessage.style.display = 'block';
    }
}

// Handle profile form submission
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullname = document.getElementById('fullname').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const farmName = document.getElementById('farm-name').value.trim();
    const location = document.getElementById('location').value.trim();
    const farmSize = document.getElementById('farm-size').value.trim();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Clear previous messages
    profileMessage.textContent = '';
    profileMessage.className = 'alert';
    profileMessage.style.display = 'none';
    
    // Validate fullname
    if (!fullname) {
        profileMessage.textContent = 'Full name is required';
        profileMessage.className = 'alert alert-danger';
        profileMessage.style.display = 'block';
        return;
    }
    
    // Validate username
    if (!username) {
        profileMessage.textContent = 'Username is required';
        profileMessage.className = 'alert alert-danger';
        profileMessage.style.display = 'block';
        return;
    }
    
    // Validate email if provided
    if (email && !email.includes('@')) {
        profileMessage.textContent = 'Please enter a valid email address';
        profileMessage.className = 'alert alert-danger';
        profileMessage.style.display = 'block';
        return;
    }
    
    // Validate passwords match if password is being changed
    if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
            profileMessage.textContent = 'Passwords do not match';
            profileMessage.className = 'alert alert-danger';
            profileMessage.style.display = 'block';
            return;
        }
        
        if (newPassword.length < 6) {
            profileMessage.textContent = 'Password must be at least 6 characters long';
            profileMessage.className = 'alert alert-danger';
            profileMessage.style.display = 'block';
            return;
        }
    }
    
    try {
        const token = getToken();
        const updateData = { username, name: fullname };
        
        // Include all fields if provided
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (farmName) updateData.farm_name = farmName;
        if (location) updateData.location = location;
        if (farmSize) updateData.farm_size = farmSize;
        
        // Only include password if it's being changed
        if (newPassword) {
            updateData.password = newPassword;
        }
        
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update profile');
        }
        
        if (data.success) {
            // Show toast notification
            if (window.toast) {
                window.toast.success('Profile updated successfully!');
            }
            
            // Also show SweetAlert2 success popup
            Swal.fire({
                icon: 'success',
                title: 'Profile Updated!',
                text: 'Your profile has been successfully updated.',
                confirmButtonColor: '#2E7D32',
                confirmButtonText: 'Great!'
            });
            
            // Hide the inline alert message
            profileMessage.style.display = 'none';
            
            // Clear password fields
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            
            // Update local storage if username changed
            const currentUser = getCurrentUser();
            if (currentUser && data.user.username !== currentUser.username) {
                currentUser.username = data.user.username;
                if (data.user.email) {
                    currentUser.email = data.user.email;
                }
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            
            // Update user identity card
            populateUserCard(data.user);
            populateFormFields(data.user);
            
            // Scroll to message
            profileMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } catch (error) {
        console.error('Error updating profile:', error);        
        // Show error toast
        if (window.toast) {
            window.toast.error(error.message || 'Failed to update profile');
        }
                profileMessage.textContent = error.message || 'Failed to update profile';
        profileMessage.className = 'alert alert-danger';
        profileMessage.style.display = 'block';
    }
});

// Change photo button handler
const changePhotoBtn = document.getElementById('changePhotoBtn');
if (changePhotoBtn) {
    changePhotoBtn.addEventListener('click', () => {
        Swal.fire({
            icon: 'info',
            title: 'Photo Upload',
            text: 'Photo upload feature coming soon!',
            confirmButtonColor: '#2E7D32',
            confirmButtonText: 'OK'
        });
        // In production, you would implement file upload here
        // const input = document.createElement('input');
        // input.type = 'file';
        // input.accept = 'image/*';
        // input.onchange = handlePhotoUpload;
        // input.click();
    });
}

// Optional: Fetch user's plots count
async function fetchUserPlotsCount() {
    try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/dashboard/farmer-stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (data.success && data.plots) {
            const totalPlotsElement = document.getElementById('total-plots-badge');
            if (totalPlotsElement) {
                totalPlotsElement.textContent = data.plots.length;
            }
        }
    } catch (error) {
        console.log('Could not fetch plots count:', error);
    }
}

// Load profile on page load
loadUserProfile();
fetchUserPlotsCount();
