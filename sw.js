// ============================================================
// 🌲 DendroGeo Service Worker v2.1 (Cache-Only, Production-Ready)
// Harita tile cache, fotoğraf cache, LRU temizliği
// NOT: Senkronizasyon artık Ana Thread (Supabase JS SDK) tarafından yapılıyor
// ============================================================

const CACHE_VERSION = 'dendrogeo-sw-v2-r3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const TILE_CACHE = `tiles-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMG_CACHE = `images-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

const MAX_TILES = 2000;
const MAX_IMAGES = 500;
const MAX_API_CACHE = 150;

const CORE_ASSETS = [
    '/', '/index.html', '/manifest.json', '/icon.png', '/social-preview.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/chart.js@4',
    'https://challenges.cloudflare.com/turnstile/v0/api.js',
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', event => {
    console.log('[SW] 🌲 Kuruluyor...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            console.log('[SW] Temel varlıklar cache\'leniyor');
            return Promise.allSettled(
                CORE_ASSETS.map(url => cache.add(url).catch(err => console.warn(`[SW] Cache başarısız: ${url}`, err)))
            );
        })
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] ✨ Aktifleştiriliyor...');
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys
                    .filter(key => key.startsWith('static-') || key.startsWith('tiles-') || key.startsWith('api-') || key.startsWith('images-'))
                    .filter(key => key !== STATIC_CACHE && key !== TILE_CACHE && key !== API_CACHE && key !== IMG_CACHE)
                    .map(key => {
                        console.log(`[SW] 🗑️ Eski cache siliniyor: ${key}`);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirstWithLimit(request, TILE_CACHE, MAX_TILES));
        return;
    }

    if (
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('challenges.cloudflare.com')
    ) {
        event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
        return;
    }

    if (url.hostname.includes('supabase.co')) {
        if (url.pathname.includes('/storage/v1/object/public/')) {
            event.respondWith(cacheFirstWithLimit(request, IMG_CACHE, MAX_IMAGES));
            return;
        }
        if (
            url.pathname.includes('/auth/v1/') ||
            url.pathname.includes('/rest/v1/rpc/') ||
            (url.pathname.includes('/storage/v1/object/') && request.method !== 'GET')
        ) {
            event.respondWith(networkOnly(request));
            return;
        }
        event.respondWith(networkFirstWithLimit(request, API_CACHE, MAX_API_CACHE));
        return;
    }

    if (url.hostname.includes('nominatim.openstreetmap.org')) {
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, responseClone));
                    return response;
                })
                .catch(() => caches.match(OFFLINE_URL).then(res => res || caches.match('/index.html')))
        );
        return;
    }

    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// 📨 Sadece SKIP_WAITING için message dinle (sync YOK)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

async function cacheFirstWithLimit(request, cacheName, limit) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
            await trimCache(cacheName, limit);
        }
        return response;
    } catch (err) {
        return new Response('Offline Content', { status: 503, statusText: 'Offline' });
    }
}

async function networkFirstWithLimit(request, cacheName, limit) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
            await trimCache(cacheName, limit);
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || fetchPromise;
}

async function networkOnly(request) {
    try {
        return await fetch(request);
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function trimCache(cacheName, limit) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > limit) {
        await cache.delete(keys[0]);
    }
}

// 🔔 Push bildirimleri (gelecek kullanım)
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    const title = data.title || 'DendroGeo Bildirim';
    const options = {
        body: data.body || 'Yeni bir güncelleme var.',
        icon: '/icon.png', badge: '/icon.png',
        data: data.url || '/', vibrate: [100, 50, 100]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === event.notification.data && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data);
        })
    );
});

console.log('[SW] 🌲 DendroGeo Service Worker v2.1 (Cache-Only) Yüklendi.');
