const CACHE_NAME = 'topenergy-v3-interdimensional';
const ASSETS = ['/', '/Index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ offline: true, message: "Modo de contingência ativo no dispositivo." }), { headers: { 'Content-Type': 'application/json' } })));
    } else {
        e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
    }
});
