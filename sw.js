const CACHE_NAME = 'kasistay-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
  './manifest.json',
  'https://i.postimg.cc/cLkWz4RY/icon-192.png',
  'https://i.postimg.cc/3xqMBfhb/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event (Network first, fallback to cache)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
        .catch(() => {
            return caches.match(event.request);
        })
    );
});
