// ================================
// TOAST NOTIFICATION SYSTEM
// ================================
class ToastManager {
    constructor() {
        this.container = this.createContainer();
    }

    createContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠'
        };
        
        const titles = {
            success: 'Success',
            error: 'Error',
            info: 'Info',
            warning: 'Warning'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close">×</div>
        `;
        
        this.container.appendChild(toast);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.hide(toast);
        });
        
        // Auto hide
        setTimeout(() => {
            this.hide(toast);
        }, duration);
        
        // Click to dismiss
        toast.addEventListener('click', (e) => {
            if (!e.target.classList.contains('toast-close')) {
                this.hide(toast);
            }
        });
    }

    hide(toast) {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }
}

// Global toast instance
window.toast = new ToastManager();

// ================================
// DARK MODE TOGGLE
// ================================
class DarkModeManager {
    constructor() {
        this.isDark = localStorage.getItem('darkMode') === 'true';
        this.init();
    }

    init() {
        // Apply saved preference
        if (this.isDark) {
            document.body.classList.add('dark-mode');
        }
        
        // Create toggle button if it doesn't exist
        this.createToggleButton();
    }

    createToggleButton() {
        // Check if toggle already exists in navbar
        const existingToggle = document.querySelector('.dark-mode-toggle');
        if (existingToggle) return;
        
        // Find the navbar user section
        const userSection = document.querySelector('.top-navbar .d-flex.align-items-center');
        if (!userSection) return;
        
        const toggle = document.createElement('div');
        toggle.className = 'dark-mode-toggle me-3';
        toggle.title = 'Toggle Dark Mode';
        toggle.style.cursor = 'pointer';
        
        toggle.addEventListener('click', () => {
            this.toggle();
        });
        
        // Insert before the username
        userSection.insertBefore(toggle, userSection.firstChild);
    }

    toggle() {
        this.isDark = !this.isDark;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', this.isDark);
        
        // Announce the change
        const message = this.isDark ? 'Dark mode enabled' : 'Light mode enabled';
        if (window.toast) {
            window.toast.info(message, 2000);
        }
    }

    enable() {
        if (!this.isDark) this.toggle();
    }

    disable() {
        if (this.isDark) this.toggle();
    }
}

// Global dark mode instance
window.darkMode = new DarkModeManager();

// ================================
// RIPPLE EFFECT
// ================================
function createRipple(event) {
    const button = event.currentTarget;
    
    // Remove existing ripples
    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) {
        existingRipple.remove();
    }
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Add ripple to all buttons
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
});

// ================================
// LOADING SKELETON GENERATOR
// ================================
class SkeletonLoader {
    static createCardSkeleton() {
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card skeleton-card skeleton"></div>
            </div>
        `;
    }

    static createPlotCardSkeleton() {
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card">
                    <div class="card-body">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text short"></div>
                        <div class="skeleton skeleton-text"></div>
                    </div>
                </div>
            </div>
        `;
    }

    static createTableRowSkeleton() {
        return `
            <tr>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
            </tr>
        `;
    }

    static showSkeletons(container, count = 3, type = 'card') {
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            switch(type) {
                case 'plot':
                    container.innerHTML += this.createPlotCardSkeleton();
                    break;
                case 'tableRow':
                    container.innerHTML += this.createTableRowSkeleton();
                    break;
                default:
                    container.innerHTML += this.createCardSkeleton();
            }
        }
    }

    static hide(container) {
        const skeletons = container.querySelectorAll('.skeleton');
        skeletons.forEach(skeleton => {
            skeleton.style.display = 'none';
        });
    }
}

// Global skeleton loader
window.SkeletonLoader = SkeletonLoader;

// ================================
// EMPTY STATE GENERATOR
// ================================
class EmptyState {
    static create(options = {}) {
        const {
            icon = '📭',
            title = 'No Data Available',
            message = 'There is nothing to display at the moment.',
            actionText = null,
            actionCallback = null
        } = options;

        const actionButton = actionText && actionCallback 
            ? `<button class="btn btn-success empty-state-action" onclick="${actionCallback}">${actionText}</button>`
            : '';

        return `
            <div class="empty-state">
                <div class="empty-state-icon floating-element">${icon}</div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-message">${message}</div>
                ${actionButton}
            </div>
        `;
    }

    static show(container, options) {
        container.innerHTML = this.create(options);
    }
}

// Global empty state
window.EmptyState = EmptyState;

// ================================
// CHART ANIMATION ENHANCER
// ================================
class ChartAnimations {
    static enhanceChart(chart) {
        if (!chart) return;
        
        // Add entrance animation
        const canvas = chart.canvas;
        if (canvas) {
            canvas.parentElement.classList.add('chart-container');
        }
        
        // Update chart options for better animations
        if (chart.options) {
            chart.options.animation = {
                duration: 1000,
                easing: 'easeInOutQuart',
                onComplete: function() {
                    // Chart animation complete
                }
            };
            
            chart.options.transitions = {
                active: {
                    animation: {
                        duration: 400
                    }
                }
            };
        }
        
        chart.update('none');
    }

    static animateProgressBar(element, targetValue, duration = 1000) {
        let start = 0;
        const increment = targetValue / (duration / 16);
        
        const animate = () => {
            start += increment;
            if (start < targetValue) {
                element.style.width = start + '%';
                element.setAttribute('aria-valuenow', Math.round(start));
                requestAnimationFrame(animate);
            } else {
                element.style.width = targetValue + '%';
                element.setAttribute('aria-valuenow', targetValue);
            }
        };
        
        animate();
    }
}

// Global chart animations
window.ChartAnimations = ChartAnimations;

// ================================
// STAGGERED ANIMATION HELPER
// ================================
function applyStaggerAnimation(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element, index) => {
        element.classList.add('stagger-item');
        element.style.animationDelay = `${index * 0.1}s`;
    });
}

// ================================
// FLOATING ELEMENT HANDLER
// ================================
function makeElementsFloat(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element, index) => {
        element.classList.add('floating-element');
        element.style.animationDelay = `${index * 0.2}s`;
    });
}

// ================================
// SMOOTH SCROLL
// ================================
function smoothScrollTo(element, duration = 500) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    if (!target) return;
    
    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function easeInOutQuad(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}

// ================================
// INITIALIZE ON DOM LOAD
// ================================
document.addEventListener('DOMContentLoaded', () => {
    // Add ripple effect to dynamically created buttons
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const buttons = node.classList?.contains('btn') 
                        ? [node] 
                        : node.querySelectorAll?.('.btn') || [];
                    
                    buttons.forEach(button => {
                        button.addEventListener('click', createRipple);
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Apply floating animations to icons
    makeElementsFloat('.card-header i');
    
    console.log('✨ Aquametic UI Enhancements Loaded');
});

// Export for use in other modules
export {
    ToastManager,
    DarkModeManager,
    SkeletonLoader,
    EmptyState,
    ChartAnimations,
    createRipple,
    applyStaggerAnimation,
    makeElementsFloat,
    smoothScrollTo
};
