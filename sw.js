/* ============================================================
   SERVICE WORKER — Labateca · Volcanes de Dios
   Versión: 2.0.0
   Estrategias:
     - cache-first        → HTML, CSS, JS, iconos, fuentes CDN
     - stale-while-revalidate → imágenes (Cloudinary), places.json y rutas.json
     - network-first      → datos dinámicos (clima Open-Meteo)
   ============================================================ */

const CACHE_VERSION = 'labateca-v14';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;

/* Archivos que se precargan al instalar el SW */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/data/places.json',
  '/data/rutas.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/images/mapa-ilustrado-placeholder.svg'
];

/* ── INSTALL: precachear los recursos esenciales ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Precache parcial:', err))
  );
});

/* ── ACTIVATE: limpiar cachés de versiones anteriores ── */
self.addEventListener('activate', event => {
  const CURRENT_CACHES = [STATIC_CACHE, IMAGE_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('labateca-') && !CURRENT_CACHES.includes(key))
          .map(key => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH: interceptar solicitudes ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // 1. API de clima (Open-Meteo) → sin interceptar, el browser lo maneja directo
  if (url.hostname === 'api.open-meteo.com') return;

  // 2. Imágenes de Cloudinary → stale-while-revalidate
  if (url.hostname.includes('cloudinary.com')) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 3. Datos (JSON y tracks GPX) → stale-while-revalidate (se actualizan con CMS/campo)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // 4. Recursos CDN (Leaflet, Google Fonts) → cache-first
  if (url.hostname !== self.location.hostname) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 5. Todo lo demás (HTML, CSS, JS, iconos) → cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

/* ============================================================
   ESTRATEGIAS
   ============================================================ */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.destination === 'document') {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
    }
    return new Response('Sin conexión', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;
  if (request.destination === 'document') {
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
  }
  return new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
