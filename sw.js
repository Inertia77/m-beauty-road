'use strict';

const CACHE_PREFIX = 'm-beauty-road';
const CACHE_VERSION = 'shell-2026-11-25-stability';
const CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const MEDIA = `${CACHE_PREFIX}-media-v1`;
const DATA = `${CACHE_PREFIX}-data-v1`;
const ROOT = self.registration.scope;
const url = (path = '') => new URL(path, ROOT).href;
const CORE = [
  url(''),
  url('index.html'),
  url('assets/app.css'),
  url('assets/lux.css'),
  url('assets/interactions.css'),
  url('assets/mobile.css'),
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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && ![CACHE, MEDIA, DATA].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function save(cache, request, response) {
  if (response.ok && response.type !== 'opaque') {
    try { await cache.put(request, response.clone()); } catch (e) { console.warn('Cache write failed', e); }
  }
  return response;
}
async function networkFirst(request, isData) {
  const cache = await caches.open(isData ? DATA : CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) return save(cache, request, response);
    if (response.status !== 429 && response.status < 500) return response;
  } catch (_) {}
  const cached = await cache.match(request) || (isData ? await (await caches.open(CACHE)).match(request) : await cache.match(request, {ignoreSearch: true}));
  if (cached) return cached;
  if (request.mode === 'navigate') {
    const shell = await cache.match(url('index.html'));
    if (shell) return shell;
  }
  return new Response('Offline or unavailable', { status: 503 });
}
async function mediaFirst(request) {
  const cache = await caches.open(MEDIA);
  const cached = await cache.match(request);
  if (cached) return cached;
  try { return await save(cache, request, await fetch(request)); }
  catch (_) { return new Response('', {status:503}); }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const target = new URL(request.url);
  if (target.origin !== self.location.origin || !target.href.startsWith(ROOT)) return;
  const path = target.pathname;
  const isMedia = path.includes('/assets/photos/') || path.includes('/assets/journeys/');
  const isData = path.includes('/data/') && path.endsWith('.json');
  event.respondWith(isMedia ? mediaFirst(request) : networkFirst(request, isData));
});
