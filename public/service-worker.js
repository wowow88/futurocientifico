// Este es el Service Worker para páginas offline y funcionalidades avanzadas

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "pwabuilder-page";
const offlineFallbackPage = "offline.html";

// Skip waiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Precache offline page
self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Offline navigation fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        const cache = await caches.open(CACHE);
        return await cache.match(offlineFallbackPage);
      }
    })());
  }
});

// 📩 Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: "FuturoCientífico", body: "¡Nueva actualización disponible!" };
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 🔄 Background Sync (simulado para POSTs fallidos)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-eduflash') {
    event.waitUntil(syncEduflashData());
  }
});

async function syncEduflashData() {
  // Aquí podrías recuperar y reintentar peticiones guardadas en IndexedDB
  console.log("⏳ Intentando sincronización en segundo plano...");
  // Implementación real depende de tu lógica de red
}

// 📅 Periodic Sync (requiere permiso y registro desde el cliente)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-eduflash') {
    event.waitUntil(fetchAndCacheEduflash());
  }
});

async function fetchAndCacheEduflash() {
  try {
    const response = await fetch('/public/eduflash.json');
    const data = await response.json();
    const cache = await caches.open(CACHE);
    await cache.put('/public/eduflash.json', new Response(JSON.stringify(data)));
    console.log("✅ Eduflash actualizado en cache con Periodic Sync");
  } catch (err) {
    console.error("⚠️ Error en Periodic Sync de eduflash", err);
  }
}

