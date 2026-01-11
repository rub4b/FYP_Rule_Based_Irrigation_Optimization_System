import { login, register } from './api.js';

// Initialize Toast Manager (enhancements.js should be loaded in HTML)
let toast;
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ToastManager !== 'undefined') {
        toast = new ToastManager();
    }
});

// Login form handler
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous errors
    errorMessage.classList.add('d-none');
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Show loading state on button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    submitBtn.disabled = true;
    
    try {
        const response = await login(username, password);
        
        if (response.success) {
            // Store token and user info - CRITICAL: Save BEFORE redirect
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('username', response.user.username || response.user.name || username);
            
            console.log('✅ Login successful! Token saved:', response.token);
            console.log('✅ User data saved:', response.user);
            
            // Show success toast
            if (toast) {
                toast.success('Login successful! Redirecting...', 2000);
            }
            
            // Small delay to ensure localStorage is written
            setTimeout(() => {
                // Redirect based on role
                if (response.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'farmer.html';
                }
            }, 100);
        }
    } catch (error) {
        // Restore button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        const errorMsg = error.message || 'Login failed. Please try again.';
        errorText.textContent = errorMsg;
        errorMessage.classList.remove('d-none');
        
        // Show error toast
        if (toast) {
            toast.error(errorMsg);
        }
    }
});

// Register form handler
const registerForm = document.getElementById('registerForm');
const registerErrorMessage = document.getElementById('register-error-message');
const registerErrorText = document.getElementById('register-error-text');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous errors
    registerErrorMessage.classList.add('d-none');
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('role').value;
    
    try {
        const response = await register(username, password, role);
        
        if (response.success) {
            // Close modal
            registerModal.hide();
            
            // Show success message
            errorText.textContent = 'Registration successful! Please login.';
            errorMessage.classList.remove('d-none');
            errorMessage.classList.remove('alert-danger');
            errorMessage.classList.add('alert-success');
            
            // Reset form
            registerForm.reset();
            
            // Reset error message styling after 3 seconds
            setTimeout(() => {
                errorMessage.classList.add('d-none');
                errorMessage.classList.remove('alert-success');
                errorMessage.classList.add('alert-danger');
            }, 3000);
        }
    } catch (error) {
        registerErrorText.textContent = error.message || 'Registration failed. Please try again.';
        registerErrorMessage.classList.remove('d-none');
    }
});
