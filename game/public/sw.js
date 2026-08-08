/* Minimal service worker so the game is installable as a PWA.
 *
 * Cache name is tied to the `v` query param used at registration
 * (see PwaBootstrap + NEXT_PUBLIC_PWA_BUILD_ID). Every production build
 * gets a new id, so activate() drops every previous mitm-shell-* cache.
 *
 * Network-first for navigations; cache-first for hashed Next assets and
 * static art. API traffic is never cached.
 */
const CACHE_VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `mitm-shell-${CACHE_VERSION}`;
const CACHE_PREFIX = "mitm-shell-";
const PRECACHE = ["/", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      ),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always hit the network for API / backend traffic.
  if (url.pathname.startsWith("/api/")) return;

  // Never cache the worker itself — clients must see new builds.
  if (url.pathname === "/sw.js") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      if (request.mode === "navigate") {
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match("/")) || Response.error();
        }
      }

      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const fresh = await fetch(request);
        if (
          fresh.ok &&
          (url.pathname.startsWith("/_next/") ||
            url.pathname.startsWith("/icons/") ||
            url.pathname.startsWith("/assets/"))
        ) {
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
