// Lets Android phones add Full Marks to the home screen as an app.
// Pages always come from the network as usual; the offline page shows only when there is no connection.
const CACHE = 'fm-offline-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return; // everything else goes straight to the network
  e.respondWith((async () => {
    try {
      return (await e.preloadResponse) || (await fetch(e.request));
    } catch (err) {
      return (await caches.match(OFFLINE)) || Response.error();
    }
  })());
});
