// frontend/js/auth-guard.js

(function() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('No token found. Redirecting to login...');
        window.location.href = '../auth/index.html';
    }
})();
