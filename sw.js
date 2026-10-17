// Offline-first service worker. Bump VERSION (and APP_VERSION in js/version.js) when shipping changes.
const VERSION = 'almanac-v2.2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/version.js', 'js/install.js', 'js/db.js', 'js/util.js', 'js/ui.js', 'js/icons.js', 'js/router.js',
  'js/views/today.js', 'js/views/notes.js', 'js/views/editor.js', 'js/views/onething.js',
  'js/views/habits.js', 'js/views/calendar.js', 'js/views/people.js', 'js/views/fields.js',
  'js/views/settings.js', 'js/views/heatmap.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Stale-while-revalidate for same-origin GETs; navigation falls back to the cached shell.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('index.html');
    return new Response('', { status: 504 });
  }));
});
