# Frontend Folder Structure

## Overview
The frontend has been reorganized into a modular structure for better maintainability, scalability, and separation of concerns.

## Directory Structure

```
frontend/
├── auth/                           # Authentication pages
│   ├── index.html                 # Login page
│   ├── login.js                   # Login logic
│   ├── register.html              # User registration
│   ├── register.js                # Registration logic
│   ├── forgot-password.html       # Password recovery
│   ├── forgot-password.js         # Password recovery logic
│   ├── reset-password.html        # Password reset
│   └── reset-password.js          # Password reset logic
│
├── farmer/                         # Farmer portal
│   ├── dashboard.html             # Farmer dashboard (formerly farmer.html)
│   ├── plots.html                 # Plot management
│   ├── sensors.html               # Sensor monitoring
│   ├── analytics.html             # Data analytics
│   ├── cost-savings.html          # Cost savings report
│   ├── profile.html               # User profile
│   └── js/                        # Farmer-specific JavaScript
│       ├── farmer.js              # Dashboard logic
│       ├── plots.js               # Plot management logic
│       ├── sensors.js             # Sensor logic
│       ├── analytics.js           # Analytics logic
│       ├── cost-savings.js        # Cost savings logic
│       └── profile.js             # Profile logic
│
├── admin/                          # Admin portal
│   ├── dashboard.html             # Admin dashboard (formerly admin.html)
│   ├── users.html                 # User management (formerly admin-users.html)
│   ├── monitoring.html            # System monitoring (formerly admin-monitoring.html)
│   ├── map.html                   # Map view (formerly admin-map.html)
│   ├── settings.html              # System settings (formerly admin-settings.html)
│   ├── register.html              # Admin registration (formerly admin-register.html)
│   └── js/                        # Admin-specific JavaScript
│       ├── admin.js               # Dashboard logic
│       ├── users.js               # User management logic (formerly admin-users-enhanced.js)
│       ├── monitoring.js          # Monitoring logic (formerly admin-monitoring.js)
│       ├── map.js                 # Map logic (formerly admin-map.js)
│       ├── settings.js            # Settings logic (formerly admin-settings.js)
│       └── common.js              # Common admin utilities (formerly admin-common.js)
│
├── shared/                         # Shared resources
│   ├── css/                       # Stylesheets
│   │   ├── style.css              # Main styles
│   │   ├── chic-styles.css        # Enhanced UI styles
│   │   └── auth-styles.css        # Authentication page styles
│   ├── img/                       # Images
│   │   └── login-bg.jpg           # Login background
│   └── js/                        # Shared JavaScript
│       ├── api.js                 # API configuration
│       ├── auth.js                # Authentication utilities
│       ├── auth-guard.js          # Route protection
│       ├── realtime.js            # Real-time updates (Socket.io)
│       ├── enhancements.js        # UI enhancements
│       └── sensor-status.js       # Sensor status utilities
│
├── manifest.json                   # PWA manifest
├── sw.js                          # Service Worker
└── icon-192.png / icon-512.png   # PWA icons

```

## Key Changes

### File Renames
- `farmer.html` → `farmer/dashboard.html`
- `admin.html` → `admin/dashboard.html`
- `admin-*.html` → `admin/*.html` (removed prefix)
- `admin-*.js` → `admin/js/*.js` (removed prefix)

### Path Updates
All file paths have been updated to reflect the new structure:
- CSS: `css/...` → `../shared/css/...`
- Shared JS: `js/...` → `../shared/js/...`
- Auth redirects: `index.html` → `../auth/index.html`
- Dashboard links: `farmer.html` → `dashboard.html`, `admin.html` → `dashboard.html`

### Smart Redirects
The `shared/js/auth.js` file now handles redirects intelligently based on the current location:
- From auth pages: stays within auth folder
- From farmer/admin pages: redirects to `../auth/index.html`

## Benefits

### 1. **Clear Separation**
- Authentication logic isolated in `auth/`
- Farmer features in `farmer/`
- Admin features in `admin/`
- Shared code in `shared/`

### 2. **Easier Navigation**
- Know exactly where to find files
- Logical grouping by functionality
- No more searching through flat structure

### 3. **Better Security**
- Can apply folder-level access control
- Clear separation of user roles
- Easier to audit permissions

### 4. **Scalability**
- Easy to add new features per role
- Can add more folders as needed (e.g., `reports/`, `settings/`)
- Team members can work on separate folders

### 5. **Maintainability**
- Related files grouped together
- Reduced naming conflicts
- Cleaner git diffs

## Migration Notes

### For Developers
1. Update any bookmarks to new paths
2. Remember the new file names (no more `farmer.html`, use `farmer/dashboard.html`)
3. All imports use relative paths (`../shared/js/...`)

### Testing Checklist
- ✅ Login redirects to correct dashboard
- ✅ Navigation links work within each section
- ✅ Logout redirects to auth/index.html
- ✅ Service Worker caches new paths
- ✅ PWA manifest points to correct start URL
- ✅ CSS and JS load correctly from shared folder
- ✅ Auth guard redirects unauthorized users

## Common Patterns

### Import Shared JS (from farmer/admin pages)
```javascript
import { API_BASE_URL } from '../../shared/js/api.js';
import { getCurrentUser, logout } from '../../shared/js/auth.js';
```

### Import Shared JS (from auth pages)
```javascript
import { API_BASE_URL } from '../shared/js/api.js';
import { login } from '../shared/js/auth.js';
```

### Link to CSS (from any subfolder)
```html
<link rel="stylesheet" href="../shared/css/style.css">
```

### Navigation Links
```html
<!-- Within farmer folder -->
<a href="dashboard.html">Dashboard</a>
<a href="plots.html">Plots</a>

<!-- Within admin folder -->
<a href="dashboard.html">Dashboard</a>
<a href="users.html">Users</a>

<!-- To login page -->
<a href="../auth/index.html">Login</a>
```

## Service Worker
The service worker (`sw.js`) has been updated to cache the new paths:
- Cache version bumped to `v2`
- All paths updated to new structure
- Offline fallback redirects to `/auth/index.html`

## Future Enhancements
Consider adding:
- `api/` folder for API mock data during development
- `components/` for reusable UI components
- `utils/` for utility functions
- `tests/` for unit and integration tests
