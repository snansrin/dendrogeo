// ============================================================ 
// 🌲 DendroGeo Service Worker v2.10 (Cache-Only, Production-Ready)
// Harita tile cache, fotoğraf cache, LRU temizliği
// NOT: Senkronizasyon artık Ana Thread (Supabase JS SDK) tarafından yapılıyor
// ============================================================

const CACHE_VERSION = 'dendrogeo-sw-v2-r34';

/* İKİ AYRI STATİK CACHE — bu ayrım bilinçli ve önemli.
 *
 * PRECACHE: CORE_ASSETS'in sorgusuz kopyaları. Yalnızca install sırasında
 *           yazılır ve ASLA trim edilmez. Çevrimdışı yedeği buna dayanır.
 * RUNTIME : çalışma zamanında eklenen ?v=NNN sürümlü script/style kopyaları.
 *           Sınırlıdır, trim edilir.
 *
 * Neden ayrıldılar: eskiden ikisi de STATIC_CACHE içindeydi ve trimCache
 * FIFO ile keys[0]'ı siliyordu. Cache.keys() ekleme sırasıyla döndüğü için
 * keys[0] HER ZAMAN install'da eklenen bir precache girdisiydi. gridplan.js
 * ?v=139'a ulaşana dek her sürüm yeni bir girdi ekledi; 150 limiti dolunca
 * precache girdileri silinmeye başladı — yani networkFirstWithLimit'in
 * çevrimdışı yedeği (origin+pathname) sessizce yok oluyordu. Uygulama
 * çevrimiçiyken kusursuz çalıştığı için bu ancak sahada, bağlantı
 * kesildiğinde fark edilirdi. */
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;
const TILE_CACHE = `tiles-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMG_CACHE = `images-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

const MAX_TILES = 2000;
const MAX_IMAGES = 500;
const MAX_API_CACHE = 150;   // Nominatim vb. API yanıtları
const MAX_RUNTIME = 400;     // ?v=NNN sürümlü script/style kopyaları

const CORE_ASSETS = [
    '/', '/index.html', '/manifest.json', '/icon.png', '/social-preview.jpg', '/css/style.css',
    '/src/config/supabase.js', '/src/config/constants.js', '/src/config/species.js', 
    '/src/utils/geo.js', '/src/utils/truncation.js', '/src/services/allometry.js', '/src/services/auth.js','/src/services/export.js', '/src/services/offline.js',
    '/src/services/admin.js','/src/services/world.js', '/src/services/measure.js','/src/services/map.js','/src/services/landcover.js','/src/services/gridplan.js','/src/services/dash.js',
    /* UI katmanı (Faz 1): index.html'in inline <script> bloğu bu dört modüle
     * taşındı — global state, toast, landing beyni ve kabuk önyüklemesi.
     * Yükleme sırası index.html'de de aynıdır: state → toast → landing → shell. */
    '/src/ui/state.js', '/src/ui/toast.js', '/src/ui/landing.js', '/src/ui/shell.js',
    /* Üçüncü taraf kütüphaneler artık depoda (vendor/) — bkz. vendor/VERSIONS.md.
     * Aynı köken oldukları için SRI gerekmiyor ve çevrimdışı davranış
     * deterministik: CDN erişilemezse ya da CDN'de farklı bir sürüm
     * çözülürse uygulama etkilenmiyor. */
    '/vendor/leaflet-1.9.4.css',
    '/vendor/leaflet-1.9.4.js',
    '/vendor/MarkerCluster-1.5.3.css',
    '/vendor/MarkerCluster.Default-1.5.3.css',
    '/vendor/leaflet.markercluster-1.5.3.js',
    '/vendor/supabase-js-2.116.0.js',
    '/vendor/chart.js-4.5.1.js',
    '/vendor/geotiff-2.1.3.js',
    /* Turnstile BİLEREK CDN'de bırakıldı: auth.js tarafından dinamik enjekte
     * ediliyor ve Cloudflare bu betiği kendi sürümlüyor; sabitlemek widget
     * güncellemelerini kırar. Bu yüzden CSP'de challenges.cloudflare.com duruyor. */
    'https://challenges.cloudflare.com/turnstile/v0/api.js',
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', event => {
    console.log('[SW] 🌲 Kuruluyor...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(PRECACHE).then(cache => {
            console.log('[SW] Temel varlıklar PRECACHE\'e yazılıyor (' + CORE_ASSETS.length + ' girdi)');
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
                    .filter(key => key.startsWith('precache-') || key.startsWith('runtime-') || key.startsWith('static-') || key.startsWith('tiles-') || key.startsWith('api-') || key.startsWith('images-'))
                    .filter(key => key !== PRECACHE && key !== RUNTIME && key !== TILE_CACHE && key !== API_CACHE && key !== IMG_CACHE)
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
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirstWithLimit(request, TILE_CACHE, MAX_TILES));
        return;
    }

    // Application JS/CSS must not execute a stale deployment while online.
    // Çalışma zamanı kopyaları RUNTIME'a yazılır (sınırlı, trim edilir);
    // çevrimdışı yedeği PRECACHE'ten okunur (sınırsız ömürlü, trim edilmez).
    if (
        url.origin === self.location.origin &&
        (request.destination === 'script' || request.destination === 'style')
    ) {
        event.respondWith(networkFirstWithLimit(request, RUNTIME, MAX_RUNTIME, PRECACHE));
        return;
    }

    /* NOT: unpkg.com ve cdn.jsdelivr.net dalları buradaydı; kütüphaneler
     * vendor/ altına alınınca (c71f239) bu sitenin artık o origin'lere HİÇ
     * isteği kalmadı, yani dallar ölü koddu ve kaldırıldı. Bir gün yeniden
     * bir CDN kullanılırsa buraya geri eklenmeli ve CSP'ye de yazılmalı —
     * scripts/check-csp.mjs bu tutarlılığı denetliyor. */
    if (
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('challenges.cloudflare.com')
    ) {
        event.respondWith(staleWhileRevalidate(request, RUNTIME));
        return;
    }

    if (
        url.hostname.includes('planetarycomputer.microsoft.com') ||
        url.hostname.endsWith('.blob.core.windows.net') ||
        url.hostname.endsWith('.s3.us-west-2.amazonaws.com')
    ) {
        // STAC and COG reads are scientific inputs; do not persist stale responses.
        event.respondWith(networkOnly(request));
        return;
    }

    if (url.hostname.includes('supabase.co')) {
        // Sadece public fotoğrafları cache'le (popup balonları için)
        if (url.pathname.includes('/storage/v1/object/public/')) {
            event.respondWith(cacheFirstWithLimit(request, IMG_CACHE, MAX_IMAGES));
            return;
        }
        // REST/Auth/RPC istekleri → doğrudan tarayıcı ağına yönlendir (CORS-güvenli passthrough)
        event.respondWith(fetch(request));
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
                    caches.open(RUNTIME).then(cache => cache.put(request, responseClone));
                    return response;
                })
                // Çevrimdışı gezinme: PRECACHE'ten oku. caches.match()
                // (cache adı verilmeyen) TÜM cache'leri arar; activate'te eski
                // sürüm silinemediyse bayat bir kopya dönebilirdi.
                .catch(() => caches.open(PRECACHE).then(c =>
                    c.match(OFFLINE_URL).then(res => res || c.match('/index.html'))
                ))
        );
        return;
    }

    event.respondWith(staleWhileRevalidate(request, RUNTIME));
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

/* Ağ öncelikli + sınırlı çalışma zamanı cache'i + PRECACHE yedeği.
 *
 * fallbackCache verilirse, çevrimdışıyken önce RUNTIME'da tam URL aranır,
 * bulunamazsa PRECACHE'te sorgusuz yol (origin + pathname) aranır. Böylece
 * "?v=139" ile istenen gridplan.js, install sırasında PRECACHE'e yazılmış
 * sorgusuz kopyasından yüklenebilir.
 *
 * ÖNEMLİ: yedek ayrı cache'ten okunur. Eskiden tek cache kullanılıyordu ve
 * trimCache FIFO ile precache girdilerini sildiği için bu yedek sessizce
 * yok oluyordu (bkz. dosya başındaki PRECACHE/RUNTIME açıklaması). */
async function networkFirstWithLimit(request, cacheName, limit, fallbackCache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
            await trimCache(cacheName, limit);
        }
        return response;
    } catch (err) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) return cached;

        // Offline + versioned asset: fall back to the unversioned precache.
        const url = new URL(request.url);
        const unversioned = url.origin + url.pathname;
        const fallbackSource = fallbackCache ? await caches.open(fallbackCache) : cache;
        const fallback = await fallbackSource.match(new Request(unversioned));
        if (fallback) return fallback;

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
            if (request.url.startsWith("http")) cache.put(request, response.clone());
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
            if (response.ok) cache.put(request, response.clone()).catch(() => {});
            return response;
        })
        .catch(async () => {
            if (cached) return cached;
            // Ağ yok ve RUNTIME'da kopya yok → PRECACHE'teki sorgusuz kopya.
            // Sabit sürümlü CDN dosyaları (leaflet@1.9.4, geotiff@2.1.3)
            // CORE_ASSETS'te tam URL'leriyle durduğu için bu yedek çalışır.
            const url = new URL(request.url);
            const pre = await caches.open(PRECACHE);
            return pre.match(request) || pre.match(new Request(url.origin + url.pathname));
        });
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

/* Cache'i limite indirir.
 *
 * İki düzeltme:
 *  1) while döngüsü — eski hali `if` ile TEK girdi siliyordu; limit bir
 *     seferde birden fazla aşılırsa (ör. toplu yükleme) yetişemiyordu.
 *  2) keys.shift() FIFO'yu açıkça belgeler. Bu fonksiyon ARTIK PRECACHE
 *     ÜZERİNDE ÇAĞRILMAMALI — precache çevrimdışı yedeğidir ve sınırsız
 *     ömürlüdür. Yalnızca RUNTIME/TILE/API/IMG üzerinde çağrılır. */
async function trimCache(cacheName, limit) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let fazla = keys.length - limit;
    while (fazla-- > 0) {
        const enEski = keys.shift();
        if (!enEski) break;
        await cache.delete(enEski);
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

console.log('[SW] 🌲 DendroGeo Service Worker v2.10 r32 — network-first app assets');
