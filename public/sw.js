// Progressive Web App Service Worker with Synchronous STDIN/I/O sync bridge
const CACHE_NAME = 'json-yaml-tree-visualizer-cache-v6';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell...', CACHE_NAME);
      return cache.addAll(PRECACHE_ASSETS);
    })
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

// 3. Message Event: STDIN IO Bridge & Lifecycle
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'STDIN_SUBMIT') {
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

  // Bypass all cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Bypass non-stdin custom api endpoints
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Bypass media and range requests to fix audio playback
  if (event.request.headers.has('range') || url.pathname.match(/\.(mp3|wav|ogg|mp4|mpeg|m4a|aac)$/i)) {
    return;
  }

  // Bypass Vite dev server requests
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx')
  ) {
    return;
  }

  // SPA Navigation Fallback (serve index.html when offline and browser navigates to path)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        // Cache the newest index.html
        if (response && response.status === 200) {
          const responseToCache1 = response.clone();
          const responseToCache2 = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseToCache1);
            cache.put('/', responseToCache2);
          });
        }
        return response;
      }).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Network-First strategy for JS/CSS assets to prevent stale chunk errors
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Stale-While-Revalidate strategy for other static resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        console.log('[Service Worker] Fetch failed offline; using cache for:', url.pathname);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
