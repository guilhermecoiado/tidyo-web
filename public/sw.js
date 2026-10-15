// Tidyo service worker: offline app shell + web push.
const SHELL = 'tidyo-shell-v1';
const ASSETS = 'tidyo-assets-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API calls go straight to the network
  if (req.mode === 'navigate') {
    // Network first for pages, fall back to the cached app shell when offline
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put('/index.html', copy)); return res; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(svg|png|webmanifest|woff2?)$/.test(url.pathname)) {
    // Build files have content hashes: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); return res; })));
  }
});

self.addEventListener('push', (e) => {
  let data = { title: 'Tidyo', body: '', url: '/', tag: 'tidyo' };
  try { data = { ...data, ...e.data.json() }; } catch (_) { /* plain push */ }
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/favicon.svg', badge: '/favicon.svg', tag: data.tag, data: { url: data.url } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
