const CACHE = 'tbank-v1';
const URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/js/script.js',
  '/assets/css/styles.css',
  '/assets/ico/tbank.png',
  '/assets/ico/tbank-logo-color.svg',
  '/assets/ico/spinner.svg',
  '/assets/ico/close-white.svg',
  '/firebase-messaging-sw.js',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
  );
});
