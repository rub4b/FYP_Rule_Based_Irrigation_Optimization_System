// Initialize Toast Manager (enhancements.js should be loaded in HTML)
let toast;
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ToastManager !== 'undefined') {
        toast = new ToastManager();
    }
    
    // Setup password requirements checker
    const passwordInput = document.getElementById('password');
    const passwordRequirements = document.getElementById('passwordRequirements');
    
    if (passwordInput && passwordRequirements) {
        passwordInput.addEventListener('focus', () => {
            passwordRequirements.style.display = 'block';
        });
        
        passwordInput.addEventListener('input', () => {
            checkPasswordRequirements(passwordInput.value);
        });
        
        passwordInput.addEventListener('blur', () => {
            // Keep visible if there are unmet requirements
            const allMet = document.querySelectorAll('.requirement.met').length === 5;
            if (allMet) {
                setTimeout(() => {
                    passwordRequirements.style.display = 'none';
                }, 500);
            }
        });
    }
});

// Check password requirements in real-time
function checkPasswordRequirements(password) {
    const requirements = {
        'req-length': password.length >= 6,
        'req-uppercase': /[A-Z]/.test(password),
        'req-lowercase': /[a-z]/.test(password),
        'req-number': /\d/.test(password),
        'req-special': /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    for (const [id, met] of Object.entries(requirements)) {
        const element = document.getElementById(id);
        if (element) {
            if (met) {
                element.classList.add('met');
                element.querySelector('i').className = 'fas fa-check-circle';
            } else {
                element.classList.remove('met');
                element.querySelector('i').className = 'fas fa-circle';
            }
        }
    }
}

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
        showError('Username is required!');
        return;
    }
    
    // Validate username format (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showError('Username can only contain letters, numbers, and underscores!');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address!');
        return;
    }
    
    // Validate password strength
    if (password.length < 6) {
        showError('Password must be at least 6 characters long!');
        return;
    }
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showError('Passwords do not match!');
        return;
    }
    
    // Show loading state on button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitBtn.disabled = true;
    
    try {
        // Wrapper for axios to support timeout
        const source = axios.CancelToken.source();
        const timeout = setTimeout(() => {
            source.cancel('Request timed out');
        }, 10000); // 10 seconds timeout

        // Make API call to register endpoint
        const response = await axios.post('http://localhost:5000/api/auth/register', {
            username: username,
            name: fullname,
            email: email,
            password: password,
            role: role // Use selected role
        }, {
            cancelToken: source.token
        });
        
        clearTimeout(timeout);
        
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
                }, 1000);
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        
        let msg = 'Registration failed. Please try again.';
        
        if (axios.isCancel(error)) {
            msg = 'Request timed out. Please check your connection.';
        } else if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            msg = error.response.data.error || 'Registration failed.';
        } else if (error.request) {
            // The request was made but no response was received
            msg = 'No response from server. Check your internet connection.';
        }
        
        showError(msg);
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
});

function showError(msg) {
    errorText.textContent = msg;
    errorMessage.classList.remove('d-none');
    if (toast) toast.error(msg);
    
    // Shake animation for error
    errorMessage.classList.add('animate__animated', 'animate__shakeX');
    setTimeout(() => {
        errorMessage.classList.remove('animate__animated', 'animate__shakeX');
    }, 1000);
}
