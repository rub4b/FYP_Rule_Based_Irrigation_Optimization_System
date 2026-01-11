import { API_BASE_URL } from './api.js';

// Initialize Toast Manager
let toast;

// Reset Password form handler
const resetPasswordForm = document.getElementById('resetPasswordForm');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const successMessage = document.getElementById('success-message');
const successText = document.getElementById('success-text');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');

// Check if token exists on page load
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ToastManager !== 'undefined') {
        toast = new ToastManager();
    }
    
    // Check if token exists in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    console.log('Current URL:', window.location.href);
    console.log('Token from URL:', token);
    
    if (!token) {
        // No token provided, show error and redirect
        errorText.textContent = 'Invalid or missing reset token. Please request a new password reset link.';
        errorMessage.classList.remove('d-none');
        
        if (toast) {
            toast.error('Invalid reset link');
        }
        
        setTimeout(() => {
            window.location.href = 'forgot-password.html';
        }, 3000);
    } else {
        console.log('Reset token found, page ready for password reset');
    }
});

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    return strength;
}

// Update password strength indicator
passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const strength = checkPasswordStrength(password);
    
    // Remove all strength classes
    strengthBar.className = 'password-strength-bar';
    
    if (password.length === 0) {
        strengthText.textContent = '';
        return;
    }
    
    if (strength <= 2) {
        strengthBar.classList.add('strength-weak');
        strengthText.textContent = 'Weak password';
        strengthText.style.color = '#f44336';
    } else if (strength <= 3) {
        strengthBar.classList.add('strength-medium');
        strengthText.textContent = 'Medium password';
        strengthText.style.color = '#ff9800';
    } else {
        strengthBar.classList.add('strength-strong');
        strengthText.textContent = 'Strong password';
        strengthText.style.color = '#4caf50';
    }
});

resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous messages
    errorMessage.classList.add('d-none');
    successMessage.classList.add('d-none');
    
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Validation
    if (password.length < 6) {
        errorText.textContent = 'Password must be at least 6 characters long';
        errorMessage.classList.remove('d-none');
        
        if (toast) {
            toast.error('Password too short');
        }
        return;
    }
    
    if (password !== confirmPassword) {
        errorText.textContent = 'Passwords do not match';
        errorMessage.classList.remove('d-none');
        
        if (toast) {
            toast.error('Passwords do not match');
        }
        return;
    }
    
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        errorText.textContent = 'Invalid reset token. Please request a new password reset link.';
        errorMessage.classList.remove('d-none');
        return;
    }
    
    // Show loading state on button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    submitBtn.disabled = true;
    
    try {
        console.log('Sending password reset request...');
        console.log('Token:', token);
        console.log('API URL:', `${API_BASE_URL}/auth/resetpassword/${token}`);
        
        const response = await fetch(`${API_BASE_URL}/auth/resetpassword/${token}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        console.log('Server response:', data);
        
        if (response.ok && data.success) {
            // Show success message
            successText.textContent = 'Password reset successful! Redirecting to login...';
            successMessage.classList.remove('d-none');
            
            // Show success toast
            if (toast) {
                toast.success('Password reset successful!', 3000);
            }
            
            // Clear form
            resetPasswordForm.reset();
            
            // Redirect to login
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            throw new Error(data.error || data.message || 'Failed to reset password');
        }
    } catch (error) {
        console.error('Password reset error:', error);
        
        // Restore button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        let errorMsg = error.message || 'Failed to reset password. Please try again.';
        
        // Handle common error cases
        if (errorMsg.toLowerCase().includes('invalid token') || errorMsg.toLowerCase().includes('expired')) {
            errorMsg = 'This reset link has expired or is invalid. Please request a new password reset.';
        }
        
        errorText.textContent = errorMsg;
        errorMessage.classList.remove('d-none');
        
        // Show error toast
        if (toast) {
            toast.error(errorMsg);
        }
    }
});
