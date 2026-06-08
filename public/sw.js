// Progressive Web App Service Worker with Synchronous STDIN/I/O sync bridge
const CACHE_NAME = 'json-yaml-tree-visualizer-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app-icon.png',
  '/og-image.png',
  '/manifest.json'
];

const pendingRequests = new Map();

// 1. Install Event: Cache Core Static Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message Event: STDIN IO Bridge
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'STDIN_SUBMIT') {
    const { sessionId, value } = data;
    if (pendingRequests.has(sessionId)) {
      const resolve = pendingRequests.get(sessionId);
      pendingRequests.delete(sessionId);
      resolve(new Response(JSON.stringify({ value: value }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  } else if (data.type === 'STDIN_CANCEL') {
    const { sessionId } = data;
    if (pendingRequests.has(sessionId)) {
      const resolve = pendingRequests.get(sessionId);
      pendingRequests.delete(sessionId);
      resolve(new Response(JSON.stringify({ value: null, cancelled: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }
});

// 4. Fetch Event: Intercept Offline caching & STDIN calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STDIN Synchronous Sync: Keep exactly as-is
  if (url.pathname === '/api/stdin-get') {
    const sessionId = url.searchParams.get('sessionId');
    if (sessionId) {
      event.respondWith(
        new Promise((resolve) => {
          pendingRequests.set(sessionId, resolve);
          
          // Safety timeout of 10 minutes to prevent permanent leak
          setTimeout(() => {
            if (pendingRequests.has(sessionId)) {
              pendingRequests.delete(sessionId);
              resolve(new Response(JSON.stringify({ value: null, timeout: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            }
          }, 600000);
        })
      );
    }
    return;
  }

  // Bypass non-GET requests or custom schemes (e.g. browser extensions, devtools)
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Bypass non-stdin custom api endpoints
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // SPA Navigation Fallback (serve index.html when offline and browser navigates to path)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache new/updated response if successful
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Suppress network errors offline
        console.log('[Service Worker] Fetch failed offline; using cache for:', url.pathname);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
