const CACHE_NAME = "yen-euros-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon1",
  "/icon",
  "/apple-icon",
];
const STATIC_ASSET = /\.(?:css|js|svg|png|ico|woff2?)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
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
            .filter((key) => key.startsWith("yen-euros-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.headers.has("RSC")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put("/", copy))
              .catch((error) => {
                console.error("Could not update the offline app shell.", error);
              });
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          const appShell = cached ?? (await cache.match("/"));
          if (appShell) return appShell;
          return Response.error();
        }),
    );
    return;
  }

  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkRequest = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch((error) => {
                console.error("Could not update the offline asset cache.", error);
              });
          }
          return response;
        });

        return cached ?? networkRequest.catch(() => Response.error());
      }),
    );
  }
});
