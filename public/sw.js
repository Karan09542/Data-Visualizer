// Service Worker for synchronous I/O bridge
const pendingRequests = new Map();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/api/stdin-get') {
    const sessionId = url.searchParams.get('sessionId');
    if (sessionId) {
      event.respondWith(
        new Promise((resolve) => {
          // Store resolve function so we can respond later
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
  }
});
