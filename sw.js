const CACHE_NAME = 'kasistay-v1';
const STATIC_CACHE = 'kasistay-static-v1';
const IMAGE_CACHE  = 'kasistay-images-v1';

// Core app shell assets to pre-cache
const APP_SHELL = [
  '/index.html',
  '/manifest.json',
  'https://i.postimg.cc/cLkWz4RY/icon-192.png',
  'https://i.postimg.cc/3xqMBfhb/icon-512.png'
];

/* ── INSTALL: pre-cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Pre-cache partial failure (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', event => {
  const KEEP = [STATIC_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: routing strategies ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Firebase, Google auth, or non-GET requests
  if (
    request.method !== 'GET' ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') && url.pathname.includes('/identitytoolkit') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com') && url.pathname.includes('/firebasejs')
  ) {
    return; // Let the browser handle these normally
  }

  // Cloudinary images → Cache-first, 7-day max, fallback to placeholder
  if (url.hostname.includes('cloudinary.com') || url.hostname.includes('res.cloudinary.com')) {
    event.respondWith(imageStrategy(request));
    return;
  }

  // Google Fonts CSS → Cache-first (long-lived)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Font Awesome CDN → Cache-first
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // App HTML → Network-first (keep fresh), fallback to cache
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Manifest, icons → Cache-first
  if (url.pathname.endsWith('.json') || url.pathname.includes('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default → Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

/* ── Strategy helpers ── */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlinePage();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}

async function imageStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Limit image cache size to 60 entries
      await trimCache(IMAGE_CACHE, 60);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return a simple SVG placeholder if image can't be fetched
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f3f4f6"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9ca3af">Image unavailable offline</text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length >= maxItems) {
    await cache.delete(keys[0]);
  }
}

function offlinePage() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KasiStay – Offline</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        body { background:#111; color:white; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2rem; }
        .logo { font-size:2.5rem; font-weight:800; letter-spacing:-2px; margin-bottom:1rem; }
        .logo span { color:#10b981; }
        h2 { font-size:1.3rem; margin-bottom:0.75rem; color:#e0e0e0; }
        p { color:#6b7280; max-width:320px; line-height:1.6; margin-bottom:2rem; }
        button { background:#10b981; color:white; border:none; padding:14px 32px; border-radius:50px; font-weight:700; font-size:1rem; cursor:pointer; }
        .icon { font-size:3rem; margin-bottom:1.5rem; opacity:0.4; }
      </style>
    </head>
    <body>
      <div class="logo">KasiStay<span>.</span></div>
      <div class="icon">📡</div>
      <h2>You're offline</h2>
      <p>Connect to the internet to browse listings and explore accommodation near you.</p>
      <button onclick="window.location.reload()">Try Again</button>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' },
    status: 200
  });
}

/* ── PUSH NOTIFICATIONS (future-ready) ── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'KasiStay', {
      body: data.body || 'New update available',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'kasistay-notification',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
