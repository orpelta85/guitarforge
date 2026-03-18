// GuitarForge Service Worker — offline caching
const CACHE_NAME = "gf-v1";
const STATIC_ASSETS = [
  "/",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  // Skip non-GET and API/proxy requests
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (url.pathname.match(/\.(js|css|svg|png|woff2?)$/) || url.pathname === "/")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || new Response("Offline", { status: 503 })))
  );
});
