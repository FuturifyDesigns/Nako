const CACHE = "nako-shell-2026-10-27-15";
const TILES = "nako-tiles-1";
const PRECACHE = [
  "./",
  "./index.html",
  "./app/",
  "./app/index.html",
  "./admin/",
  "./admin/index.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
  "./assets/css/landing.css",
  "./assets/icons/favicon.svg",
  "./assets/icons/nako-mark.svg",
  "./assets/icons/nako-logo.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/images/botswana-flag.png",
  "./assets/vehicles/taxi-mark.png",
  "./assets/vehicles/kombi-mark.png",
  "./assets/vehicles/bus-mark.png",
  "./assets/vehicles/taxi.png",
  "./assets/vehicles/kombi.png",
  "./assets/vehicles/bus.png",
  "./assets/fonts/manrope-400.woff2",
  "./assets/fonts/manrope-600.woff2",
  "./assets/fonts/manrope-700.woff2",
  "./assets/fonts/manrope-800.woff2",
  "./assets/fonts/outfit-700.woff2",
  "./vendor/maplibre-gl.js",
  "./vendor/maplibre-gl.css",
  "./vendor/three.module.js",
  "./vendor/supabase.js",
  "./vendor/gsap.min.js",
  "./vendor/ScrollTrigger.min.js",
  "./data/catalog.js",
  "./src/js/mode.js",
  "./src/js/home.js",
  "./src/js/landing.js",
  "./src/js/demo.js",
  "./src/js/i18n.js",
  "./src/js/app-boot.js",
  "./src/js/admin-boot.js",
  "./src/js/admin.js",
  "./src/js/passenger.js",
  "./src/js/sync.js",
  "./src/js/install.js",
  "./src/js/config.js",
  "./src/js/dom.js",
  "./src/js/geo.js",
  "./src/js/idb.js",
  "./src/js/session.js",
  "./src/js/simulate.js",
  "./src/js/models.js",
  "./src/js/vehicle-layer.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        /* A missing optional file should not block the shell. */
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE && key !== TILES).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname.endsWith("openfreemap.org")) {
    event.respondWith((async () => {
      const cache = await caches.open(TILES);
      const cached = await cache.match(request);
      if (cached) return cached;
      const fresh = await fetch(request);
      if (fresh.ok) {
        cache.put(request, fresh.clone());
        trim(TILES, 180);
      }
      return fresh;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(request)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    try {
      const fresh = await fetch(request);
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    } catch {
      if (cached) return cached;
      throw new Error("offline");
    }
  })());
});
