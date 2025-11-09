self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("grahabhedam-v2").then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./manifest.json",
        "./src/app.js",
        "./src/RagaData.js",
        "./src/GrahabhedamEngine.js",
        "./src/audioPlayer.js",
        "./src/style.css"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});

