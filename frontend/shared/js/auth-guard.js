// frontend/js/auth-guard.js

(function() {
    // Check both localStorage and sessionStorage
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
        console.warn('No token found. Redirecting to login...');
        window.location.href = '../auth/index.html';
    }
})();
