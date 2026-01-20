// admin-monitoring.js - System monitoring and audit logs
import { API_BASE_URL } from '../../shared/js/api.js';
import { getToken } from '../../shared/js/auth.js';
import { initAdminPage } from './common.js';

// Initialize admin page (handles auth, UI, sidebar)
const user = initAdminPage();
if (!user) {
    throw new Error('Authentication failed');
}

const token = getToken();

let currentPage = 1;
const limit = 50;

// Load system performance metrics
async function loadSystemPerformance() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/system-performance`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch performance data');

        const result = await response.json();
        const data = result.data;

        // Update uptime
        document.getElementById('uptime').textContent = data.uptime.formatted;

        // Update database stats
        document.getElementById('total-users').textContent = data.database.users.total;
        document.getElementById('active-plots').textContent = data.database.plots.active;
        document.getElementById('sensor-data-24h').textContent = data.activity.sensorDataLast24h;

        // Update memory usage
        document.getElementById('memory-rss').textContent = `${data.memory.rss} MB`;
        document.getElementById('memory-heap-used').textContent = `${data.memory.heapUsed} MB`;
        document.getElementById('memory-heap-total').textContent = `${data.memory.heapTotal} MB`;
        document.getElementById('memory-external').textContent = `${data.memory.external} MB`;

    } catch (error) {
        console.error('Error loading performance data:', error);
    }
}

// Load audit logs
async function loadAuditLogs(page = 1, action = '') {
    try {
        let url = `${API_BASE_URL}/admin/audit-logs?page=${page}&limit=${limit}`;
        if (action) url += `&action=${action}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch audit logs');

        const result = await response.json();
        const logs = result.data;
        const pagination = result.pagination;

        if (page === 1) {
            renderAuditLogs(logs);
        } else {
            appendAuditLogs(logs);
        }

        // Update pagination info
        document.getElementById('logs-shown').textContent = Math.min(page * limit, pagination.total);
        document.getElementById('logs-total').textContent = pagination.total;

        // Show/hide load more button
        const loadMoreBtn = document.getElementById('load-more-logs');
        if (page >= pagination.pages) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-block';
        }

    } catch (error) {
        console.error('Error loading audit logs:', error);
        Swal.fire('Error', 'Failed to load audit logs', 'error');
    }
}

function renderAuditLogs(logs) {
    const tbody = document.getElementById('audit-logs-body');
    
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                    <p class="text-muted mb-0">No audit logs found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const timestamp = new Date(log.createdAt).toLocaleString();
        const userName = log.userId?.username || 'System';
        const statusBadge = getStatusBadge(log.status);
        
        return `
            <tr>
                <td>${timestamp}</td>
                <td>
                    <span class="badge bg-light text-dark">${userName}</span>
                </td>
                <td><span class="badge bg-info">${log.action}</span></td>
                <td>${log.resource}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary" onclick="viewLogDetails('${log._id}')">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function appendAuditLogs(logs) {
    const tbody = document.getElementById('audit-logs-body');
    
    const newRows = logs.map(log => {
        const timestamp = new Date(log.createdAt).toLocaleString();
        const userName = log.userId?.username || 'System';
        const statusBadge = getStatusBadge(log.status);
        
        return `
            <tr>
                <td>${timestamp}</td>
                <td>
                    <span class="badge bg-light text-dark">${userName}</span>
                </td>
                <td><span class="badge bg-info">${log.action}</span></td>
                <td>${log.resource}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary" onclick="viewLogDetails('${log._id}')">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.insertAdjacentHTML('beforeend', newRows);
}

function getStatusBadge(status) {
    switch (status) {
        case 'SUCCESS':
            return '<span class="badge bg-success">Success</span>';
        case 'FAILURE':
            return '<span class="badge bg-danger">Failure</span>';
        case 'WARNING':
            return '<span class="badge bg-warning">Warning</span>';
        default:
            return '<span class="badge bg-secondary">Unknown</span>';
    }
}

window.viewLogDetails = async function(logId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        const log = result.data.find(l => l._id === logId);

        if (!log) {
            Swal.fire('Error', 'Log details not found', 'error');
            return;
        }

        Swal.fire({
            title: 'Audit Log Details',
            html: `
                <div class="text-start">
                    <p><strong>Action:</strong> ${log.action}</p>
                    <p><strong>Resource:</strong> ${log.resource}</p>
                    <p><strong>User:</strong> ${log.userId?.username || 'System'}</p>
                    <p><strong>Status:</strong> ${log.status}</p>
                    <p><strong>IP Address:</strong> ${log.ipAddress || 'N/A'}</p>
                    <p><strong>Timestamp:</strong> ${new Date(log.createdAt).toLocaleString()}</p>
                    <hr>
                    <p><strong>Details:</strong></p>
                    <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 200px; overflow: auto;">${JSON.stringify(log.details, null, 2)}</pre>
                </div>
            `,
            width: '600px',
            confirmButtonText: 'Close'
        });
    } catch (error) {
        console.error('Error viewing log details:', error);
        Swal.fire('Error', 'Failed to load log details', 'error');
    }
};

// Send notification
document.getElementById('send-notification').addEventListener('click', async () => {
    const subject = document.getElementById('notif-subject').value.trim();
    const message = document.getElementById('notif-message').value.trim();
    const targetRole = document.getElementById('notif-target').value;

    if (!subject || !message) {
        Swal.fire('Error', 'Please provide both subject and message', 'error');
        return;
    }

    const confirm = await Swal.fire({
        title: 'Send Notification?',
        text: `This will send the notification to ${targetRole || 'all users'}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Send',
        cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/notify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject,
                message,
                targetRole: targetRole || undefined
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send notification');
        }

        const result = await response.json();

        Swal.fire({
            icon: 'success',
            title: 'Notification Sent!',
            html: `Successfully sent to ${result.data.successful} out of ${result.data.total} users`,
            confirmButtonText: 'OK'
        });

        // Clear form
        document.getElementById('notif-subject').value = '';
        document.getElementById('notif-message').value = '';
        document.getElementById('notif-target').value = '';

    } catch (error) {
        console.error('Error sending notification:', error);
        Swal.fire('Error', error.message || 'Failed to send notification', 'error');
    }
});

// Refresh logs button
document.getElementById('refresh-logs').addEventListener('click', () => {
    currentPage = 1;
    const action = document.getElementById('filter-action').value;
    loadAuditLogs(currentPage, action);
    loadSystemPerformance();
});

// Filter action change
document.getElementById('filter-action').addEventListener('change', () => {
    currentPage = 1;
    const action = document.getElementById('filter-action').value;
    loadAuditLogs(currentPage, action);
});

// Load more logs button
document.getElementById('load-more-logs').addEventListener('click', () => {
    currentPage++;
    const action = document.getElementById('filter-action').value;
    loadAuditLogs(currentPage, action);
});

// Initial load
loadSystemPerformance();
loadAuditLogs(currentPage);

// Auto-refresh performance every 30 seconds
setInterval(loadSystemPerformance, 30000);
