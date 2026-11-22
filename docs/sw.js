const cacheName = 'kerbukovo-app-v1.0.1';
const scope = self.registration.scope;
const appFiles = new Set([
    './', './index.html', './site.css', './app.js', './manifest.webmanifest',
    './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'
].map(path => new URL(path,scope).href));

self.addEventListener('install', event => {
    event.waitUntil(caches.open(cacheName)
        .then(cache => cache.addAll([...appFiles].map(url => new Request(url,{cache:'reload'}))))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(key => key.startsWith('kerbukovo-app-') && key!==cacheName)
            .map(key=>caches.delete(key))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    if (event.request.method!=='GET') return;
    const url = new URL(event.request.url);
    const navigation = event.request.mode==='navigate'
        && (url.pathname===new URL(scope).pathname || url.pathname===new URL('index.html',scope).pathname)
        && url.origin===new URL(scope).origin;
    if (!navigation && !appFiles.has(url.href)) return;
    event.respondWith(fetch(event.request).catch(async () => {
        const cache=await caches.open(cacheName);
        const saved=await cache.match(navigation?scope:event.request);
        return saved||Response.error();
    }));
});
