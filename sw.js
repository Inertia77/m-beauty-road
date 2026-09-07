'use strict';

const CACHE_PREFIX = 'm-beauty-road';
const CACHE_VERSION = 'shell-2026-09-07-final-a';
const CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const ROOT = self.registration.scope;
const url = (path = '') => new URL(path, ROOT).href;
const CORE = [
  url(''),
  url('index.html'),
  url('assets/app.css'),
  url('assets/lux.css'),
  url('assets/interactions.css'),
  url('assets/app.js'),
  url('assets/interactions.js'),
  url('data/photos.json'),
  url('data/journeys.json'),
  url('manifest.webmanifest'),
  url('assets/icon-192.png'),
  url('assets/icon-512.png'),
  url('assets/apple-touch-icon-180.png'),
  url('assets/maskable-icon-512.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE).map((key) => caches.delete(key))))
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
    const response = await fetch(request, { cache: 'no-store' });
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then((response) => putIfCacheable(request, response)).catch(() => null);
  return cached || await update || new Response('', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isImage = request.destination === 'image' || requestUrl.pathname.includes('/assets/photos/') || requestUrl.pathname.includes('/assets/journeys/');
  event.respondWith(isImage ? staleWhileRevalidate(request) : networkFirst(request));
});
