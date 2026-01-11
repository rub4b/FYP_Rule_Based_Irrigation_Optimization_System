// Initialize Toast Manager (enhancements.js should be loaded in HTML)
let toast;
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ToastManager !== 'undefined') {
        toast = new ToastManager();
    }
});

// Registration form handler
const registerForm = document.getElementById('registerForm');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous errors
    errorMessage.classList.add('d-none');
    
    // Get form values
    const fullname = document.getElementById('fullname').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('role').value; // Get selected role
    
    // Validate username
    if (!username) {
        const msg = 'Username is required!';
        errorText.textContent = msg;
        errorMessage.classList.remove('d-none');
        if (toast) toast.error(msg);
        return;
    }
    
    // Validate username format (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        const msg = 'Username can only contain letters, numbers, and underscores!';
        errorText.textContent = msg;
        errorMessage.classList.remove('d-none');
        if (toast) toast.error(msg);
        return;
    }
    
    // Validate passwords match
    if (password !== confirmPassword) {
        const msg = 'Passwords do not match!';
        errorText.textContent = msg;
        errorMessage.classList.remove('d-none');
        if (toast) toast.error(msg);
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        const msg = 'Password must be at least 6 characters long!';
        errorText.textContent = msg;
        errorMessage.classList.remove('d-none');
        if (toast) toast.error(msg);
        return;
    }
    
    // Show loading state on button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitBtn.disabled = true;
    
    try {
        // Make API call to register endpoint
        const response = await axios.post('http://localhost:5000/api/auth/register', {
            username: username,
            name: fullname,
            email: email,
            password: password,
            role: role // Use selected role
        });
        
        if (response.data.success) {
            // Show success message with SweetAlert2
            let successMessage = 'Your account has been created. Please login to continue.';
            let buttonColor = '#2E7D32';
            
            if (role === 'admin') {
                successMessage = 'Admin account created! Please use the Admin Login portal to access your account.';
                buttonColor = '#dc3545';
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Registration Successful!',
                text: successMessage,
                confirmButtonColor: buttonColor,
                confirmButtonText: 'Go to Login',
                showClass: {
                    popup: 'animate__animated animate__fadeInDown'
                },
                hideClass: {
                    popup: 'animate__animated animate__fadeOutUp'
                }
            }).then(() => {
                // Show success toast
                if (toast) toast.success('Redirecting to login...');
                
                // Redirect to login page
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            });
        }
    } catch (error) {
        // Restore button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        // Handle errors
        const errorMsg = error.response?.data?.error || error.message || 'Registration failed. Please try again.';
        errorText.textContent = errorMsg;
        errorMessage.classList.remove('d-none');
        
        // Show error toast
        if (toast) toast.error(errorMsg);
    }
});
