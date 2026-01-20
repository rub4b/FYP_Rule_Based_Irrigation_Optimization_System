// Real-time WebSocket connection module
// Uses Socket.io for live sensor updates, alerts, and notifications

import { API_BASE_URL } from './api.js';

const BASE_URL = API_BASE_URL.replace('/api', ''); // Remove /api suffix for WebSocket
const WS_URL = BASE_URL.replace(/^http/, 'ws'); // Convert http to ws protocol

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Connection status callbacks
const connectionListeners = new Set();
const dataListeners = new Map(); // event -> Set of callbacks

// Initialize WebSocket connection
function connectWebSocket() {
  if (socket && socket.connected) {
    console.log('WebSocket already connected');
    return socket;
  }

  console.log('Connecting to WebSocket server...');
  
  // Load Socket.io from CDN if not available
  if (typeof io === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
    script.onload = () => initializeSocket();
    document.head.appendChild(script);
    return null;
  }

  return initializeSocket();
}

function initializeSocket() {
  socket = io(BASE_URL, {
    reconnection: true,
    reconnectionDelay: RECONNECT_DELAY,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    transports: ['websocket', 'polling'],
    autoConnect: true
  });

  // Connection established
  socket.on('connect', () => {
    console.log('✓ WebSocket connected:', socket.id);
    reconnectAttempts = 0;
    updateConnectionStatus(true);
    notifyListeners('connection', { connected: true, socketId: socket.id });
  });

  // Connection lost
  socket.on('disconnect', (reason) => {
    console.log('✗ WebSocket disconnected:', reason);
    updateConnectionStatus(false);
    notifyListeners('connection', { connected: false, reason });
  });

  // Connection error
  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      updateConnectionStatus(false, 'Failed to connect after multiple attempts');
    }
  });

  // Reconnection attempt
  socket.on('reconnect_attempt', () => {
    console.log(`Reconnection attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);
  });

  // Real-time sensor data updates
  socket.on('sensorData', (data) => {
    console.log('Sensor data received:', data);
    notifyListeners('sensorData', data);
  });

  // Sensor status updates (battery, signal, etc.)
  socket.on('sensorStatus', (data) => {
    console.log('Sensor status update:', data);
    notifyListeners('sensorStatus', data);
  });

  // Device online/offline status
  socket.on('deviceStatus', (data) => {
    console.log('Device status update:', data);
    notifyListeners('deviceStatus', data);
  });

  // Critical moisture alerts
  socket.on('criticalAlert', (data) => {
    console.log('Critical alert:', data);
    notifyListeners('criticalAlert', data);
    showCriticalAlertNotification(data);
  });

  return socket;
}

// Update connection status indicator
function updateConnectionStatus(connected, message = '') {
  const statusIndicators = document.querySelectorAll('.ws-status-indicator');
  
  statusIndicators.forEach(indicator => {
    if (connected) {
      indicator.classList.remove('offline', 'error');
      indicator.classList.add('online');
      indicator.title = 'Real-time updates active';
      indicator.innerHTML = '<i class="fas fa-circle text-success"></i> Live';
    } else {
      indicator.classList.remove('online');
      indicator.classList.add('offline');
      indicator.title = message || 'Disconnected from real-time updates';
      indicator.innerHTML = '<i class="fas fa-circle text-danger"></i> Offline';
    }
  });
}

// Show critical alert notification
function showCriticalAlertNotification(alert) {
  // Browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Critical Moisture Alert!', {
      body: `${alert.plotName}: ${alert.moisture}% moisture (${alert.level})`,
      icon: '/img/icon-192x192.png',
      badge: '/img/icon-192x192.png',
      tag: `alert-${alert.plotId}`,
      requireInteraction: true
    });
  }

  // Toast notification on page
  const toast = document.createElement('div');
  toast.className = `alert alert-${alert.level === 'low' ? 'danger' : 'warning'} alert-dismissible fade show position-fixed`;
  toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  toast.innerHTML = `
    <strong>⚠️ Critical Alert!</strong><br>
    <strong>${alert.plotName}</strong>: ${alert.moisture}% moisture<br>
    <small>${alert.level === 'low' ? 'Too dry - irrigation needed' : 'Too wet - check drainage'}</small>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(toast);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    toast.remove();
  }, 10000);

  // Play alert sound
  playAlertSound();
}

// Play alert sound
function playAlertSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURQKW6vn77BgGgg+ltryxHkqBSN4yPDbkUALFGC06+OTTR4KTKHh78JyJAUuhM/z1Ic0Bx5uwO/jmFEUClur5++wYBoIVqXn77BgGgdFo+LvwXEkBS2AzvPYiDgHGmm77+ibURLKTZ/h7rVfGQc9kNXyz3wpBCR0w+/alUQLE1606uSWTxwKR5za8sFxJAUrgM7z2Ig4Bxppu+/om1ESClSm5++wXxoHRKPi78FxJAUugM7z2Ig4BxpovO/hmVESClWl5++wYBoIQKTi78JyJQUshM/z14c0Bx1txe7hmVATClao5++wYBoHQ6Pj78FxJAUuhM/z1og4Bxppu+/omVISCler5++wYBoHRaTj78JyJQUshM/z14c0Bxxtxe7hmVISClWl5++wYBoHRKPj78FxJAUugM7z2Ig4BxpovO/hmVATClWm5++wYBoHRKPj78JyJQUsgM7z2Ig4Bxltxe7hmVATC1Wm5++wYBoHRKPj78JyJQUshM/z14c0Bxxtxe7hmVASClWl5++wYBoHRKPj78JxJQUsgM7z2Ig4BxpovO/hmVATClWl5++wYBoHRKPj7sJyJQUsgM7z2Ig4BxpovO/hmVATClWl5++wYBoHRKPj7sJyJQUshM/z14c0Bxptxe7hmVASClWm5++wYBoHRKPj78JyJQUsgM7z2Ig4Bxltxe7hmVATClWm5++wYBoHRKPj7sJyJQUshM/z14c0Bxptxe7hmVASClWm5++wYBoHRKPj7sJyJQUsgM7z2Ig4Bxltxe7hmVATClWm5++wYBoHRKPj7sJyJQUshM/z14c0Bxptxe7hmVASClWm5++wYBoHRKPj7sJyJQUshM/z2Ig4Bxltxe7hmVATClWm5++wYBoHRKPj7sJyJQUsgM7z14c0Bxptxe7hmVASClWm5++wYBoHRKPj7sJyJQUsgM7z2Ig4BxltxO7hmVASClWm5++wYBoHRKPj7sJyJQUsgM7z14c0Bxptxe7hmVATClWm5++wYBoHRKPj7sJyJQUsgM7z2Ig4Bxltxe7hmVATClWm5++wYBoHRKPj7sJyJQUsgM7z14c0Bxptxe7hmVATClWm5++wYBoHRKPj7sJyJQUsgM7z2Ig4BxpuvO/hmVATClWm5++wYBoHRKPj7sJyJQUsgM7z14c0Bxptxe7hmVASClWm5++wYBoHRKPj7sJyJQUsgM7z2Ig4BxlvxO7hmVATClWm5++wYBoHRKPj7sJyJQUsgM7z14c0Bxptxe7hmVASClWm5++wYBoHRKPj7sJyJQU=');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
  } catch (e) {
    console.log('Alert sound not available');
  }
}

// Subscribe to plot-specific updates
function subscribePlot(plotId) {
  if (socket && socket.connected) {
    socket.emit('subscribePlot', plotId);
    console.log(`Subscribed to plot ${plotId} updates`);
  }
}

// Unsubscribe from plot updates
function unsubscribePlot(plotId) {
  if (socket && socket.connected) {
    socket.emit('unsubscribePlot', plotId);
    console.log(`Unsubscribed from plot ${plotId} updates`);
  }
}

// Register listener for specific event
function onEvent(eventName, callback) {
  if (!dataListeners.has(eventName)) {
    dataListeners.set(eventName, new Set());
  }
  dataListeners.get(eventName).add(callback);
}

// Unregister listener
function offEvent(eventName, callback) {
  if (dataListeners.has(eventName)) {
    dataListeners.get(eventName).delete(callback);
  }
}

// Notify all listeners for an event
function notifyListeners(eventName, data) {
  if (dataListeners.has(eventName)) {
    dataListeners.get(eventName).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventName} listener:`, error);
      }
    });
  }
}

// Request browser notification permission
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('Notification permission:', permission);
    });
  }
}

// Disconnect WebSocket
function disconnectWebSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('WebSocket disconnected');
  }
}

// Check if connected
function isConnected() {
  return socket && socket.connected;
}

// Export for use in other modules
window.RealtimeService = {
  connect: connectWebSocket,
  disconnect: disconnectWebSocket,
  subscribePlot,
  unsubscribePlot,
  onEvent,
  offEvent,
  isConnected,
  requestNotificationPermission
};

// Auto-connect on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    requestNotificationPermission();
  });
} else {
  connectWebSocket();
  requestNotificationPermission();
}
