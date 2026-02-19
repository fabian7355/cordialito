/* ================================================
   CORDIALITO — Service Worker v1.0
   https://fabian7355.github.io/cordialito/
================================================ */

const CACHE_NAME    = 'cordialito-v1';
const DYNAMIC_CACHE = 'cordialito-dynamic-v1';

const STATIC_ASSETS = [
  '/cordialito/',
  '/cordialito/index.html',
  '/cordialito/manifest.json',
  '/cordialito/icons/icon-192.png',
  '/cordialito/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700;800;900&display=swap',
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const { request } = event;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);
  const isDynamic = url.pathname.includes('/api/') || url.pathname.includes('/live/');

  if (isDynamic) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (['style','script','font','image'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(DYNAMIC_CACHE)).put(request, response.clone());
    return response;
  } catch {
    return offlineFallback();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(DYNAMIC_CACHE)).put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || offlineFallback();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(r => {
    if (r.ok) cache.put(request, r.clone());
    return r;
  }).catch(() => null);
  return cached || await fetchPromise || offlineFallback();
}

function offlineFallback() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cordialito — Sin conexión</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: 'Inter', sans-serif;
          background: #060B14; color: #E8EDF5;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          min-height: 100vh; text-align: center; padding: 24px; gap: 20px;
        }
        .logo {
          width:72px; height:72px;
          background: linear-gradient(135deg,#F0B429,#C97D0E);
          border-radius:16px; display:flex;
          align-items:center; justify-content:center;
          font-size:38px;
        }
        h1 { font-size:26px; letter-spacing:2px; color:#F0B429; }
        p  { font-size:14px; color:#7A8BA0; max-width:260px; line-height:1.6; }
        button {
          background: linear-gradient(135deg,#F0B429,#C97D0E);
          color:#060B14; border:none; border-radius:10px;
          padding:14px 28px; font-size:14px; font-weight:800; cursor:pointer;
        }
      </style>
    </head>
    <body>
      <div class="logo">🎰</div>
      <h1>CORDIALITO</h1>
      <p>Sin conexión a internet. Reconéctate para seguir apostando.</p>
      <button onclick="location.reload()">🔄 Reintentar</button>
    </body>
    </html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ---------- PUSH NOTIFICATIONS ---------- */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '🎰 Cordialito', {
      body:    data.body || 'Tienes una nueva notificación',
      icon:    '/cordialito/icons/icon-192.png',
      badge:   '/cordialito/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/cordialito/' },
      actions: [
        { action: 'open',    title: '🎯 Ver ahora' },
        { action: 'dismiss', title: 'Cerrar' },
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/cordialito/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
