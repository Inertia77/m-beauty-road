'use strict';

const CACHE = 'm-beauty-road-v2';
const ROOT = self.registration.scope;
const url = (path = '') => new URL(path, ROOT).href;
const CORE = [
  url(''),
  url('index.html'),
  url('assets/app.css'),
  url('assets/app.js'),
  url('data/photos.json'),
  url('manifest.webmanifest'),
  url('assets/icon-192.png'),
  url('assets/icon-512.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function putIfCacheable(request, response) {
  if (response?.ok && response.type !== 'opaque') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return await putIfCacheable(request, response);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match(url('index.html'));
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    return await putIfCacheable(request, response);
  } catch (error) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isArchiveImage = request.destination === 'image' || requestUrl.pathname.includes('/assets/photos/');
  event.respondWith(isArchiveImage ? cacheFirst(request) : networkFirst(request));
});
