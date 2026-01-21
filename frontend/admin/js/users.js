// admin-users-enhanced.js - Enhanced user management functionality
import { API_BASE_URL } from '../../shared/js/api.js';
import { getToken } from '../../shared/js/auth.js';
import { initAdminPage } from './common.js';

// Initialize admin page (handles auth, UI, sidebar)
const user = initAdminPage();
if (!user) {
    throw new Error('Authentication failed');
}

const token = getToken();

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        const result = await response.json();
        const users = result.users || result.data || [];

        // Ensure users is an array
        if (!Array.isArray(users)) {
            console.error('Invalid users data:', users);
            throw new Error('Invalid data format received from server');
        }

        // Update counts
        document.getElementById('total-users-count').textContent = users.length;
        const adminCount = users.filter(u => u.role === 'admin').length;
        const farmerCount = users.filter(u => u.role === 'farmer').length;
        document.getElementById('admin-count').textContent = adminCount;
        document.getElementById('farmer-count').textContent = farmerCount;

        // Render table
        renderUsersTable(users);

    } catch (error) {
        console.error('Error loading users:', error);
        Swal.fire('Error', 'Failed to load users', 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <i class="fas fa-users fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No users found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const avatarClass = user.role === 'admin' ? 'admin-avatar' : 'farmer-avatar';
        const statusBadge = getStatusBadge(user.status || 'active');
        const roleBadge = user.role === 'admin' 
            ? '<span class="badge bg-primary"><i class="fas fa-shield-alt"></i> Admin</span>'
            : '<span class="badge bg-success"><i class="fas fa-user"></i> Farmer</span>';

        return `
            <tr>
                <td>
                    <div class="user-avatar ${avatarClass}">
                        ${getInitials(user.name || user.username)}
                    </div>
                </td>
                <td>
                    <div class="fw-semibold">${user.name || 'N/A'}</div>
                    <div class="text-muted small">@${user.username}</div>
                </td>
                <td>
                    <i class="fas fa-envelope text-muted"></i> ${user.email}
                </td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-info" onclick="viewUser('${user._id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="editUser('${user._id}')" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="changeStatus('${user._id}', '${user.status || 'active'}')" title="Change Status">
                            <i class="fas fa-toggle-on"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteUser('${user._id}', '${user.username}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusBadge(status) {
    switch (status) {
        case 'active':
            return '<span class="badge bg-success"><i class="fas fa-check-circle"></i> Active</span>';
        case 'inactive':
            return '<span class="badge bg-secondary"><i class="fas fa-pause-circle"></i> Inactive</span>';
        case 'suspended':
            return '<span class="badge bg-danger"><i class="fas fa-ban"></i> Suspended</span>';
        default:
            return '<span class="badge bg-info">Unknown</span>';
    }
}

// Global functions for buttons
window.viewUser = async function(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        const users = result.users || result.data || [];
        
        if (!Array.isArray(users)) {
            throw new Error('Invalid data format received from server');
        }
        
        const user = users.find(u => u._id === userId);

        if (!user) {
            Swal.fire('Error', 'User not found', 'error');
            return;
        }

        Swal.fire({
            title: `User Details: ${user.username}`,
            html: `
                <div class="text-start">
                    <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Role:</strong> ${user.role}</p>
                    <p><strong>Status:</strong> ${user.status || 'active'}</p>
                    <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
                    <p><strong>Farm Name:</strong> ${user.farm_name || 'N/A'}</p>
                    <p><strong>Location:</strong> ${user.location || 'N/A'}</p>
                    <p><strong>Created:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Close'
        });
    } catch (error) {
        console.error('Error viewing user:', error);
        Swal.fire('Error', 'Failed to load user details', 'error');
    }
};

window.editUser = async function(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        const users = result.users || result.data || [];
        
        if (!Array.isArray(users)) {
            throw new Error('Invalid data format received from server');
        }
        
        const user = users.find(u => u._id === userId);

        if (!user) {
            Swal.fire('Error', 'User not found', 'error');
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: `Edit User: ${user.username}`,
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label class="form-label">Name</label>
                        <input id="edit-name" class="form-control" value="${user.name || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input id="edit-email" type="email" class="form-control" value="${user.email}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Phone</label>
                        <input id="edit-phone" class="form-control" value="${user.phone || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Farm Name</label>
                        <input id="edit-farm-name" class="form-control" value="${user.farm_name || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Location</label>
                        <input id="edit-location" class="form-control" value="${user.location || ''}">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Update',
            preConfirm: () => {
                return {
                    name: document.getElementById('edit-name').value,
                    email: document.getElementById('edit-email').value,
                    phone: document.getElementById('edit-phone').value,
                    farm_name: document.getElementById('edit-farm-name').value,
                    location: document.getElementById('edit-location').value
                };
            }
        });

        if (formValues) {
            const updateResponse = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formValues)
            });

            if (!updateResponse.ok) {
                const error = await updateResponse.json();
                throw new Error(error.message || 'Update failed');
            }

            Swal.fire('Success', 'User updated successfully', 'success');
            loadUsers();
        }
    } catch (error) {
        console.error('Error editing user:', error);
        Swal.fire('Error', error.message || 'Failed to update user', 'error');
    }
};

window.changeStatus = async function(userId, currentStatus) {
    const { value: formValues } = await Swal.fire({
        title: 'Change User Status',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">New Status</label>
                    <select id="new-status" class="form-select">
                        <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${currentStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                        <option value="suspended" ${currentStatus === 'suspended' ? 'selected' : ''}>Suspended</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Reason (optional)</label>
                    <textarea id="status-reason" class="form-control" rows="3" placeholder="Provide a reason for status change..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Change Status',
        preConfirm: () => {
            return {
                status: document.getElementById('new-status').value,
                reason: document.getElementById('status-reason').value
            };
        }
    });

    if (formValues) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formValues)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Status change failed');
            }

            Swal.fire('Success', 'User status updated successfully', 'success');
            loadUsers();
        } catch (error) {
            console.error('Error changing status:', error);
            Swal.fire('Error', error.message || 'Failed to change status', 'error');
        }
    }
};

window.deleteUser = async function(userId, username) {
    const result = await Swal.fire({
        title: 'Delete User?',
        text: `Are you sure you want to delete user "${username}"? This action cannot be undone!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Delete failed');
            }

            Swal.fire('Deleted!', 'User has been deleted successfully', 'success');
            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            Swal.fire('Error', error.message || 'Failed to delete user', 'error');
        }
    }
};

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', loadUsers);

// Load users on page load
loadUsers();
