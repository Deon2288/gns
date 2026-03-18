'use strict';

// Cache names
const CACHE_NAME = 'static-cache-v1';
const DATA_CACHE_NAME = 'data-cache-v1';

// Files to cache
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/favicon.ico'
];

// Install Service Worker
self.addEventListener('install', function(evt) {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching app shell');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', function(evt) {
    evt.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log('Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Request Handler
self.addEventListener('fetch', function(evt) {
    // Cache data requests
    if (evt.request.url.includes('/api/')) {
        evt.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return fetch(evt.request)
                    .then((response) => {
                        // If we get a valid response, put it in the cache
                        if (response.status === 200) {
                            cache.put(evt.request, response.clone());
                        }
                        return response;
                    })
                    .catch(() => {
                        // If the request fails, try to return a cached response
                        return cache.match(evt.request);
                    });
            })
        );
        return;
    }
    // Handle standard page requests
    evt.respondWith(
        caches.match(evt.request).then((response) => {
            return response || fetch(evt.request);
        })
    );
});