/**
 * LLM Wiki Viewer — Service Worker
 *
 * Caches static assets and graph data so the app works offline
 * for previously visited pages.
 */

const CACHE_NAME = 'wiki-viewer-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/data/graph.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache static assets (JS/CSS/HTML)
  if (request.method === 'GET' && (url.pathname.startsWith('/assets/') || url.pathname === '/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Cache graph data
  if (request.method === 'GET' && url.pathname === '/data/graph.json') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('[]', { status: 503, headers: { 'Content-Type': 'application/json' } }));
      })
    );
    return;
  }

  // Network-first for API calls
  if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => {
        return cached || new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }))
    );
  }
});
