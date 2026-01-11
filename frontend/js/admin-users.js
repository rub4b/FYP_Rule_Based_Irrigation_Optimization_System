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
 * Generates initials from username for avatar
 * @param {string} name - User's name/username
 * @returns {string} - Initials (max 2 characters)
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Fetches all users from the API
 */
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users`, {
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
        const users = data.users || data || [];
        
        // Update counts
        document.getElementById('total-users-count').textContent = users.length;
        
        const adminCount = users.filter(u => u.role === 'admin').length;
        const farmerCount = users.filter(u => u.role === 'farmer').length;
        
        document.getElementById('admin-count').textContent = adminCount;
        document.getElementById('farmer-count').textContent = farmerCount;
        
        // Display users
        displayUsers(users);
        
    } catch (error) {
        console.error('Error loading users:', error);
        displayErrorMessage();
    }
}

/**
 * Displays users in the table
 * @param {Array} users - Array of user objects
 */
function displayUsers(users) {
    const tableBody = document.getElementById('users-table-body');
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <i class="fas fa-users text-muted" style="font-size: 2rem;"></i>
                    <p class="text-muted mt-3 mb-0">No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = users.map(user => {
        const initials = getInitials(user.username || user.name || user.email);
        const avatarClass = user.role === 'admin' ? 'admin-avatar' : 'farmer-avatar';
        
        // Role badge
        const roleBadge = user.role === 'admin' 
            ? '<span class="badge bg-primary"><i class="fas fa-shield-alt"></i> Admin</span>'
            : '<span class="badge bg-success"><i class="fas fa-user"></i> Farmer</span>';
        
        // Status badge
        const statusBadge = user.status === 'active' || !user.status
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-danger">Banned</span>';
        
        return `
            <tr>
                <td>
                    <div class="user-avatar ${avatarClass}">
                        ${initials}
                    </div>
                </td>
                <td>
                    <div class="fw-semibold">${user.username || user.name || 'N/A'}</div>
                    <small class="text-muted">ID: ${user._id || user.id || 'Unknown'}</small>
                </td>
                <td>
                    <i class="fas fa-envelope text-muted"></i> ${user.email || 'N/A'}
                </td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editUser('${user._id || user.id}')" title="Edit User">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteUser('${user._id || user.id}', '${user.username || user.email}')" title="Delete User">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Displays error message in table
 */
function displayErrorMessage() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-5">
                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 2rem;"></i>
                <p class="text-danger mt-3 mb-0">Failed to load users</p>
                <p class="text-muted small">Please check your connection and try again</p>
            </td>
        </tr>
    `;
}

/**
 * Edit user (placeholder function)
 * @param {string} userId - User ID
 */
window.editUser = function(userId) {
    Swal.fire({
        title: 'Edit User',
        text: `User ID: ${userId}`,
        icon: 'info',
        html: `
            <p>Edit functionality will be implemented here.</p>
            <p class="text-muted small">User ID: ${userId}</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        confirmButtonColor: '#2E7D32',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                icon: 'success',
                title: 'Coming Soon',
                text: 'User edit functionality will be implemented',
                confirmButtonColor: '#2E7D32'
            });
        }
    });
};

/**
 * Delete user with confirmation
 * @param {string} userId - User ID
 * @param {string} username - Username for display
 */
window.deleteUser = function(userId, username) {
    Swal.fire({
        title: 'Delete User?',
        html: `Are you sure you want to delete user <strong>${username}</strong>?<br><small class="text-muted">This action cannot be undone.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#C62828',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to delete user');
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'User has been deleted successfully.',
                    confirmButtonColor: '#2E7D32'
                });

                // Reload users
                loadUsers();

            } catch (error) {
                console.error('Error deleting user:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete user. Please try again.',
                    confirmButtonColor: '#2E7D32'
                });
            }
        }
    });
};

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
    await loadUsers();
    
    // Restore button
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
    
    // Show success toast
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Users refreshed',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
});

// Initial load
loadUsers();
