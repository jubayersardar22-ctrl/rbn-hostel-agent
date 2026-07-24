self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("nibedika-pwa").then(cache => {
      return cache.addAll([
        "/dashboard.html",
        "/icon.svg"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
