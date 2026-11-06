// Onyx service worker: offline app shell. Scoped to this folder only.
const VERSION = 'onyx-v2';
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/program.js',
  'js/exercises.js',
  'js/units.js',
  'js/timer.js',
  'js/icons.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('onyx-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || event.request.method !== 'GET') return;
  // Network first so updates land quickly; the cache keeps it working offline.
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      if (res.ok) (await caches.open(VERSION)).put(event.request, res.clone());
      return res;
    } catch {
      const cache = await caches.open(VERSION);
      return (await cache.match(event.request, { ignoreSearch: true })) || (await cache.match('index.html'));
    }
  })());
});
