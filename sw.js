// Service worker mínimo para que la app se pueda instalar. Su alcance es solo /lectorqrcdc/.
// Siempre usa la red primero; si no hay conexión, sirve la última copia de los archivos propios.
const CACHE = "lectorqr-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("lectorqr-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
