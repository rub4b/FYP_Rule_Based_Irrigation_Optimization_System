import { API_BASE_URL } from '../shared/js/api.js';

// Initialize Toast Manager
let toast;
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ToastManager !== 'undefined') {
        toast = new ToastManager();
    }
});

// Forgot Password form handler
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const successMessage = document.getElementById('success-message');
const successText = document.getElementById('success-text');

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous messages
    errorMessage.classList.add('d-none');
    successMessage.classList.add('d-none');
    
    const email = document.getElementById('email').value;
    
    // Show loading state on button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgotpassword`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Show success message
            successText.textContent = 'Password reset link has been sent to your email. Please check your inbox and spam folder.';
            successMessage.classList.remove('d-none');
            
            // Show success toast
            if (toast) {
                toast.success('Reset link sent! Check your email.', 5000);
            }
            
            // Clear form
            forgotPasswordForm.reset();
            
            // Optional: Redirect to login after a delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 5000);
        } else {
            throw new Error(data.error || data.message || 'Failed to send reset email');
        }
    } catch (error) {
        // Restore button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        const errorMsg = error.message || 'Failed to send reset email. Please try again.';
        errorText.textContent = errorMsg;
        errorMessage.classList.remove('d-none');
        
        // Show error toast
        if (toast) {
            toast.error(errorMsg);
        }
    }
});
