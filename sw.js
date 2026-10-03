// ============================================================ 
// 🌲 DendroGeo Service Worker v2.10 (Cache-Only, Production-Ready)
// Harita tile cache, fotoğraf cache, LRU temizliği
// NOT: Senkronizasyon artık Ana Thread (Supabase JS SDK) tarafından yapılıyor
// ============================================================

const CACHE_VERSION = 'dendrogeo-sw-v2-r68';

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
    '/', '/index.html', '/manifest.json', '/icon.png', '/apple-touch-icon.png', '/social-preview.jpg', '/css/style.css',
    '/css/landing.css',
    '/src/config/supabase.js', '/src/config/constants.js', '/src/config/species.js', '/src/config/i18n.js', 
    '/src/utils/geo.js', '/src/utils/truncation.js', '/src/utils/lazylibs.js', '/src/services/allometry.js', '/src/services/auth.js','/src/services/export.js', '/src/services/offline.js',
    /* SAHA UX (2026-10-03): 77–300 waypoint sayfalama, iOS konum toastı,
     * aktif park kimliği ve yüzey inceleme hizalama/nesne kanıt katmanı.
     * lazylibs tarafından dinamik yüklenir; çevrimdışı saha için precache şart. */
    '/src/services/field-ux.js',
    /* YÖNETİM ZİNCİRİ (Faz 6): ziyaret sayacı, veri talepleri, kullanıcı yönetimi,
     * yedek ve moderasyon çekirdeği ayrı modüller. */
    '/src/services/visit-stats.js','/src/services/data-requests.js','/src/services/user-admin.js','/src/services/backup.js',
    '/src/services/admin.js','/src/services/admin-tree.js','/src/services/world.js', '/src/services/measure.js','/src/services/map.js',
    /* SİTE İÇİNDEN RAPOR YAYINI (2026-09-27): report_requests kuyruğu +
     * rapor/yayin-kuyrugu.json günlüğü → 📄 Yayınla / 🔗 Aç / 📤 Paylaş. */
    '/src/services/report-publish.js',
    /* PARK ÇALIŞMA ARKADAŞI (0025): davet/kabul kartları + ortak proje listesi. */
    '/src/services/park-invites.js',
    /* LULC ZİNCİRİ (Faz 5): eski landcover.js altı modüle bölündü; facade son sırada
     * (window.DG_LANDCOVER'u o kurar, yükleme anında lc-* global'lerini referanslar). */
    '/src/services/lc-config.js','/src/services/lc-geo.js','/src/services/lc-stac.js','/src/services/lc-engine.js','/src/services/lc-osm.js','/src/services/lc-patches.js','/src/services/lc-validate.js','/src/services/lc-s2.js','/src/ui/lc-report.js','/vendor/polygon-clipping-0.15.7.js','/src/services/lc-review.js','/src/ui/lc-sens.js','/src/services/landcover.js',
    /* PARK ZİNCİRİ (Faz 4): eski gridplan.js yedi modüle bölündü — yükleme
     * sırası index.html ile aynı olmalı (state → client → geometry → query →
     * engine → panel → export). */
    /* park-registry.js (2026-09-24): park kimliği + ölçüm kapısı. Sıra
     * index.html ile aynı: query'den sonra, grid-engine'den önce. */
    '/src/services/park-state.js','/src/services/osm-client.js','/src/services/park-geometry.js','/src/services/geofence.js','/src/services/park-query.js','/src/services/park-registry.js','/src/services/grid-engine.js','/src/ui/park-panel.js','/src/ui/park-export.js',
    '/src/services/dash.js',
    /* UI katmanı (Faz 1): index.html'in inline <script> bloğu bu dört modüle
     * taşındı — global state, toast, landing beyni ve kabuk önyüklemesi.
     * Yükleme sırası index.html'de de aynıdır: state → toast → landing → shell. */
    '/src/ui/state.js', '/src/ui/toast.js', '/src/ui/landing.js', '/src/ui/shell.js',
    '/css/park-panel.css','/css/ui-standard.css',
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
                    caches.open(PRECACHE).then(cache => cache.put('/', responseClone)).catch(() => {});
                    return response;
                })
                .catch(() => caches.open(PRECACHE).then(cache => cache.match(OFFLINE_URL)))
        );
        return;
    }

    event.respondWith(fetch(request));
});

async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems);
}

async function cacheFirstWithLimit(request, cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
        trimCache(cacheName, maxItems).catch(() => {});
    }
    return response;
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
    } catch (e) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw e;
    }
}

async function networkFirstWithLimit(request, runtimeName, maxItems, fallbackName) {
    const runtime = await caches.open(runtimeName);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            runtime.put(request, response.clone()).catch(() => {});
            trimCache(runtimeName, maxItems).catch(() => {});
        }
        return response;
    } catch (e) {
        const direct = await runtime.match(request);
        if (direct) return direct;
        // Sürüm sorgusu (?v=NNN) precache'te yoktur; pathname'in sorgusuz
        // kopyası install sırasında yazılmıştır. Aynı-köken varsayımı yukarıda
        // garanti edildi, bu yüzden yalnız path ile güvenli fallback yapılır.
        const fallback = await caches.open(fallbackName);
        const plain = await fallback.match(new URL(request.url).pathname);
        if (plain) return plain;
        throw e;
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
    }).catch(() => null);
    return cached || network || fetch(request);
}

async function networkOnly(request) {
    return fetch(request);
}
