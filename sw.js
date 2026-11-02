// Service worker: guarda la app en el celular para abrirla rápido y sin internet.
// No guarda datos de facturas: esos viven solo en localStorage.
// IMPORTANTE: al cambiar cualquier archivo de la app, sube VERSION para que el celular reciba la actualización.
const VERSION = 'v4';
const CACHE = 'lectorqr-' + VERSION;
const APP = [
  './', 'index.html', 'app.js', 'parser.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];
const CDN = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(APP);
    // Las librerías del CDN se intentan guardar, pero si falla la red no se bloquea la instalación
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k.startsWith('lectorqr-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// La página pide activar la versión nueva cuando el usuario toca "Actualizar"
self.addEventListener('message', e => {
  if (e.data === 'activar') self.skipWaiting();
});

// Primero la copia guardada; si no está, se pide a la red y se guarda (solo app y CDN conocidos)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === self.location.origin;
  if (!propio && !CDN.includes(req.url)) return;

  e.respondWith(caches.match(req, { ignoreSearch: propio }).then(guardado => {
    if (guardado) return guardado;
    return fetch(req).then(resp => {
      if (resp.ok && (propio || resp.type === 'cors')) {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return resp;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
  }));
});
