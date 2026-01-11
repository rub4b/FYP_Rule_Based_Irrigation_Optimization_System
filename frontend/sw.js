const CACHE_NAME = 'farm-management-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/farmer.html',
  '/admin.html',
  '/css/style.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/login.js',
  '/js/farmer.js',
  '/js/admin.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('Service Worker: Cache failed', err);
      })
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch strategy: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone();
        
        // Cache the fetched response for future use
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        
        return response;
      })
      .catch(() => {
        // If fetch fails, try to get from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Service Worker: Serving from cache', event.request.url);
            return cachedResponse;
          }
          
          // If not in cache, return offline page or error
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Handle background sync for offline sensor data submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sensor-data') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(syncSensorData());
  }
});

async function syncSensorData() {
  try {
    // Get pending sensor data from IndexedDB or localStorage
    const pendingData = await getPendingSensorData();
    
    if (pendingData && pendingData.length > 0) {
      for (const data of pendingData) {
        await fetch(`${self.location.origin}/api/sensor/manual`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          },
          body: JSON.stringify(data.payload)
        });
      }
      
      // Clear pending data after successful sync
      await clearPendingSensorData();
      console.log('Service Worker: Sensor data synced successfully');
    }
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

async function getPendingSensorData() {
  // This would typically use IndexedDB
  // For now, returning empty array
  return [];
}

async function clearPendingSensorData() {
  // Clear from IndexedDB or storage
  return Promise.resolve();
}
