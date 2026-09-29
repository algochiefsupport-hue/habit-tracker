/**
 * HabitPulse Offline Service Worker
 * Enables 100% offline functionality, instant loading, and PWA installation.
 */

const CACHE_NAME = 'habitpulse-v1.0.5';

const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'main.css',
  'components.css',
  'responsive.css',
  'firebase-sync.js',
  'api.js',
  'audio.js',
  'notifications.js',
  'auth.js',
  'dashboard.js',
  'habits.js',
  'tasks.js',
  'tomorrow.js',
  'calendar.js',
  'insights.js',
  'goals.js',
  'settings.js',
  'onboarding.js',
  'app.js'
];

// Install: Cache all static assets for offline use
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching all app shell assets for offline use');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some assets skipped during pre-cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Serve from cache when offline, or network-first for HTML
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST, PUT, DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (e.g. opening root page / or index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // OFFLINE: Return cached index.html or root
          return caches.match('index.html').then((cached) => {
            return cached || caches.match('./');
          });
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, PNG, JSON, Icons)
  // Use Stale-While-Revalidate: Return cached immediately, fetch update in background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, nothing to do since cachedResponse is returned
        });

      return cachedResponse || fetchPromise;
    })
  );
});
