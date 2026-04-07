const CACHE_NAME = 'highst-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './favicon.png',
    './manifest.json'
];

// 설치: 정적 자산 캐싱
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// 활성화: 구 캐시 삭제
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// fetch: Firebase/Google API는 항상 네트워크, 나머지는 Cache-First
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Firebase, Google API, CDN은 네트워크 직접 요청
    const bypassHosts = [
        'firebaseio.com', 'firestore.googleapis.com', 'firebase.google.com',
        'gstatic.com', 'googleapis.com', 'unpkg.com', 'cdn.tailwindcss.com',
        'cdn.jsdelivr.net', 'identitytoolkit.googleapis.com'
    ];
    if (bypassHosts.some(h => url.hostname.includes(h))) return;

    // 정적 자산: Cache-First
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            });
        })
    );
});
