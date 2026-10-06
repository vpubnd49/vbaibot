// VBAIBot PWA Service Worker
const CACHE_NAME = 'vbaibot-pwa-v2';

self.addEventListener('install', (event) => {
  // Kích hoạt ngay lập tức không cần đợi tab cũ đóng
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Bỏ qua các API dynamic requests
  if (url.includes('/api/')) {
    return;
  }

  // Luôn ưu tiên MẠNG (Network-First) cho trang HTML/navigation để không bao giờ bị kẹt giao diện cũ
  if (event.request.mode === 'navigate' || event.request.destination === 'document' || url.endsWith('/') || url.includes('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Đối với assets tĩnh (js, css, images có hash): Cache first, fallback network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});

