/* ============================================================
   SERVICE WORKER — Labateca · Volcanes de Dios
   Versión: 2.0.0
   Estrategias:
     - cache-first        → HTML, CSS, JS, iconos, fuentes CDN
     - stale-while-revalidate → imágenes (Cloudinary), places.json y rutas.json
     - network-first      → datos dinámicos (clima Open-Meteo)
   ============================================================ */

const CACHE_VERSION = 'labateca-v200';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;

/* Archivos que se precargan al instalar el SW */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/lugares.html',
  '/pueblo.html',
  '/viva.html',
  '/transporte.html',
  '/historia/virgen-de-las-angustias.html',
  '/historia/himno-de-labateca.html',
  '/historia/fotos-antiguas.html',
  '/en/history/our-lady-of-sorrows.html',
  '/styles.css?v=200',
  '/app.js',
  '/offline.html',
  '/manifest.json',
  '/data/places.json',
  '/data/rutas.json',
  '/data/eventos.json',
  '/data/guia.json',
  '/data/conductores.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/images/mapa-labateca.svg',
  '/data/mapa.json'
];

/* ── INSTALL: precachear los recursos esenciales ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      /* cache:'reload' obliga a ir a la red. Sin esto, addAll puede
         guardar en la caché nueva una copia VIEJA servida por el caché
         HTTP del navegador o por el borde de Cloudflare, y entonces la
         versión nueva nace con archivos del lote anterior. */
      .then(cache => cache.addAll(
        PRECACHE_URLS.map(u => new Request(u, { cache: 'reload' }))
      ))
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

  // 0. Panel de administración → NUNCA cachear (siempre fresco, con sus cabeceras actuales)
  if (url.pathname.startsWith('/admin')) return;

  // 1. APIs dinámicas → sin interceptar, el browser las maneja directo
  //    (clima, chat IA, reseñas, subida de fotos de visitantes)
  if (url.hostname === 'api.open-meteo.com') return;
  if (url.hostname === 'api.met.no') return;
  if (url.hostname === 'labateca-chat.labatecacolombia.workers.dev') return;
  if (url.hostname === 'labateca-reviews.labatecacolombia.workers.dev') return;
  if (url.hostname === 'api.cloudinary.com') return;
  // Google My Maps incrustado (mapa real) → lo maneja el navegador directo, sin cachear
  if (url.hostname.endsWith('google.com')) return;
  // Cloudflare Web Analytics (beacon) → directo, sin cachear ni interceptar
  if (url.hostname.endsWith('cloudflareinsights.com')) return;

  // 2. Imágenes de Cloudinary → SIN interceptar (las maneja el navegador directo).
  //    Antes pasaban por stale-while-revalidate, pero el SW re-emitía estas
  //    peticiones cross-origin (no-cors) y en algunos Android esa re-emisión
  //    fallaba y devolvía un respaldo que ROMPÍA la imagen (ícono partido),
  //    aunque la misma URL abierta directo en el navegador sí cargaba.
  //    Dejándolas pasar directo se comportan igual que el enlace directo
  //    (probado y funcionando en celular). Se pierde el cacheo offline de
  //    fotos, pero la prioridad es que las imágenes se vean siempre.
  if (url.hostname.includes('cloudinary.com')) return;

  /* 2-bis. Miniaturas de YouTube (i.ytimg.com) y el reproductor incrustado.
     MISMO fallo que Cloudinary: la regla 4 mandaba estas peticiones
     cross-origin a cacheFirst, el SW las re-emitia, el cache.put de la
     respuesta opaca fallaba y el catch devolvia un 503 fabricado por el
     propio SW. Resultado: la miniatura del video NUNCA se veia en
     produccion, aunque en local -sin SW- si. Medido en el sitio ya
     desplegado: i.ytimg naturalWidth 0, Cloudinary 60, y cinco 503 en
     consola sin una sola violacion de CSP. */
  if (url.hostname.endsWith('ytimg.com')) return;
  if (url.hostname.endsWith('youtube.com')) return;
  if (url.hostname.endsWith('youtube-nocookie.com')) return;
  if (url.hostname.endsWith('googlevideo.com')) return;

  // 3. Datos (JSON y tracks GPX) → stale-while-revalidate (se actualizan con CMS/campo)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  /* 3-bis. Media (el MP3 del himno) → SIN interceptar.
     Un <audio> no pide el archivo entero: pide trozos con la cabecera
     Range para poder adelantar. Si el service worker responde con el
     archivo completo y un 200, el navegador no puede buscar dentro de la
     pista y en algunos casos ni la reproduce. Dejarlo pasar directo hace
     que el servidor conteste 206 como debe. Tampoco conviene cachearlo:
     son 2 MB que casi nadie va a oír dos veces. */
  if (url.pathname.startsWith('/media/')) return;

  /* 4. CUALQUIER host externo -> SIN interceptar.
     Antes iban a cacheFirst y NUNCA funciono. El service worker se sirve con
     el CSP del sitio (/* cubre /sw.js) y, dentro del worker, un fetch()
     cuenta como connect-src. connect-src no incluye fonts.googleapis.com, ni
     los mosaicos del mapa, ni unpkg: el fetch lanzaba excepcion, el catch
     devolvia un 503 fabricado por el propio SW y el recurso se perdia.
     Medido en produccion: la hoja de Google Fonts daba 503 con el SW activo,
     y la cache -static- no tenia NI UN recurso externo, prueba de que
     cacheFirst jamas completo uno. Es el mismo fallo que ya estaba
     documentado arriba para Cloudinary, pero afectando a todo lo de fuera.
     Se pierde el cacheo offline de las fuentes, que de todos modos nunca
     existio; el navegador las cachea por su cuenta con sus cabeceras. */
  if (url.hostname !== self.location.hostname) return;

  // 5. Navegación / documentos HTML → network-first: SIEMPRE fresco si hay
  //    conexión (evita servir versiones viejas), con caché como respaldo offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDoc(request));
    return;
  }

  // 6. Todo lo demás (CSS, JS, iconos del propio sitio) → cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

/* Documentos HTML: red primero, caché como respaldo, offline.html si todo falla. */
async function networkFirstDoc(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request) || await cache.match('/') || await cache.match('/index.html');
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    return offline || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

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
