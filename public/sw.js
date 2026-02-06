/* public/sw.js */

/**
 * FuturoCientífico Service Worker (minimal, no Workbox)
 * - HTML/navigation: network-first (fallback cache)
 * - JSON & static assets: stale-while-revalidate
 */

const CACHE_VERSION = "v3-2026-02-06";
const STATIC_CACHE = `fc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fc-runtime-${CACHE_VERSION}`;

// Ajusta/añade rutas si cambian tus JSON (estos 2 ya existen en tu proyecto)
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/eduflash.json",
  // "/articles_enriched.json", // no precache; se gestiona en runtime
  // Opcionales (si existen en tu public):
  // "/favicon.svg",
  // "/avatar-cientifico.webp",
  // "/icons/icon-192.png",
  // "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      // No usamos cache.addAll porque si 1 ruta falla (404) rompe toda la instalación.
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch (_) {
            // Silencioso: si algún recurso no existe, no rompe el SW
          }
        })
      );

      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("fc-") && !k.includes(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo cacheamos same-origin (evita liarse con Amazon/externos)
  if (url.origin !== self.location.origin) return;

  // 1) Navegación (HTML): network-first
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  const pathname = url.pathname;

  // 2) JSON: stale-while-revalidate (rápido y se actualiza)
  if (
    pathname.endsWith(".json") ||
    pathname === "/eduflash.json" ||
    pathname === "/articles_enriched.json" ||
    pathname === "/articles.json"
  ) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 3) Assets estáticos: stale-while-revalidate
  const isStatic =
    ["style", "script", "image", "font"].includes(req.destination) ||
    /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|gif|woff2?|ttf|eot|ico)$/i.test(
      pathname
    );

  if (isStatic) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 4) Resto: intento cache-first suave, y si no, network
  event.respondWith(cacheFirst(req));
});

// ---------- Strategies ----------

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const fresh = await fetch(request);
    // Solo cachea respuestas OK (evita guardar 404/500)
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Fallback final para navegación: home
    const home = await caches.open(STATIC_CACHE).then((c) => c.match("/"));
    if (home) return home;

    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = (async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch (_) {
      return null;
    }
  })();

  // Devuelve cache inmediatamente si existe; si no, espera a red.
  return cached || (await fetchPromise) || fetch(request);
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}
