/* Service worker for PWA installability.
 *
 * Intentionally network-only while the game is under active development:
 * caching Next chunks / pages is what leaves localhost stuck on stale
 * "Loading the street..." after a rebuild. Activate still drops any older
 * mitm-shell-* caches left from earlier experiments.
 *
 * Cache name is tied to the `v` query param used at registration
 * (see PwaBootstrap + NEXT_PUBLIC_PWA_BUILD_ID).
 */
const CACHE_VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "mitm-shell-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
  // CACHE_VERSION is part of the registered script URL (`/sw.js?v=...`).
  void CACHE_VERSION;
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
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  // Pass through to the network. Keeping a fetch handler is enough for
  // installability without freezing players on an old shell.
  event.respondWith(fetch(request));
});
