const CACHE_NAME = "web-cal-shell-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests. Everything else (calendar proxy
  // calls, CalDAV/WebCal fetches, cross-origin requests) must always hit the
  // network so events stay live and never resolve to stale cached data.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  if (new URL(request.url).pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached ?? cache.match(OFFLINE_URL));

      return cached ?? networkFetch;
    })
  );
});
