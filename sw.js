const CACHE = 'xsixiang-quiz-v4';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll([
        '.',
        'index.html',
        'css/style.css',
        'js/app.js',
        'js/questions.js',
        'manifest.json',
      ]);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(CACHE).then((cache) => {
      return cache.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      });
    })
  );
});
