// ============================================================ 
// 🌲 DendroGeo Service Worker v2.10 (Cache-Only, Production-Ready)
// Harita tile cache, fotoğraf cache, LRU temizliği
// NOT: Senkronizasyon artık Ana Thread (Supabase JS SDK) tarafından yapılıyor
// ============================================================

const CACHE_VERSION = 'dendrogeo-sw-v2-r169';

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
    '/src/config/supabase.js', '/src/config/constants.js', '/src/config/measurement-protocol-lock.js', '/src/config/wood-density-lock.js', '/src/config/species.js', '/src/config/i18n.js', 
    '/src/services/osm-water-backup.js', '/src/utils/geo.js', '/src/utils/truncation.js', '/src/utils/lazylibs.js', '/src/domain/trees/photo-quality.js','/src/domain/trees/allometry.js','/src/application/trees/calculate-tree-carbon.js','/src/application/trees/calculate-tree-carbon-from-circumference.js','/src/application/trees/validate-measurement.js','/src/services/allometry.js', '/src/services/auth.js','/src/services/export.js', '/src/services/offline.js',
    /* YÖNETİM ZİNCİRİ (Faz 6): ziyaret sayacı, veri talepleri, kullanıcı yönetimi,
     * yedek ve moderasyon çekirdeği ayrı modüller. */
    '/src/application/visitors/build-live-activity.js','/src/application/visitors/build-live-roster.js','/src/services/visit-stats.js','/src/services/data-requests.js','/src/services/user-admin.js','/src/services/backup.js',
    '/src/services/admin.js','/src/services/admin-tree.js','/src/services/world.js', '/src/services/measure.js','/src/services/map.js','/src/services/field-ux.js',
    /* SİTE İÇİNDEN RAPOR YAYINI (2026-09-27): report_requests kuyruğu +
     * rapor/yayin-kuyrugu.json günlüğü → 📄 Yayınla / 🔗 Aç / 📤 Paylaş. */
    '/src/core/surface-display.js',
    '/src/domain/reports/report-context.js',
    '/src/core/report-context.js',
    '/src/application/reports/collect-publication-request.js',
    '/src/services/academic-profile.js',
    '/css/academic-profile.css',
    '/src/services/report-publish.js',
    /* PARK ÇALIŞMA ARKADAŞI (0025): davet/kabul kartları + ortak proje listesi. */
    '/src/services/park-invites.js',
    /* LULC ZİNCİRİ (Faz 5): eski landcover.js altı modüle bölündü; facade son sırada
     * (window.DG_LANDCOVER'u o kurar, yükleme anında lc-* global'lerini referanslar). */
    '/src/services/lc-config.js','/src/domain/surface/classify-landcover-code.js','/src/domain/surface/compare-source-class-areas.js','/src/services/lc-geo.js','/src/services/lc-stac.js','/src/domain/surface/merge-tile-results.js','/src/adapters/surface/result-exports.js','/src/application/surface/analyze-source.js','/src/adapters/surface/process-landcover-tile.js','/src/services/lc-engine.js','/src/services/lc-osm.js','/src/domain/surface/patch-geometry.js','/src/domain/surface/group-patch-cells.js','/src/domain/surface/measure-patch-components.js','/src/domain/surface/query-green-patches.js','/src/services/lc-patches.js','/src/services/lc-validate.js','/src/services/lc-s2.js','/src/ui/lc-report.js','/vendor/polygon-clipping-0.15.7.js','/src/workers/surface-worker.js','/src/contracts/surface-review.js','/src/adapters/surface/review-store.js','/src/domain/surface/review-geometry.js','/src/adapters/surface/osm-review-objects.js','/src/adapters/surface/review-worker.js','/src/application/surface/prepare-review.js','/src/application/surface/merge-review-features.js','/src/services/lc-review.js','/src/ui/lc-sens.js','/src/domain/surface/quality-gates.js','/src/contracts/surface-analysis.js','/src/application/surface/run-analysis.js','/src/services/landcover.js',
    /* PARK ZİNCİRİ (Faz 4): eski gridplan.js yedi modüle bölündü — yükleme
     * sırası index.html ile aynı olmalı (state → client → geometry → query →
     * engine → panel → export). */
    /* park-registry.js (2026-09-24): park kimliği + ölçüm kapısı. Sıra
     * index.html ile aynı: query'den sonra, grid-engine'den önce. */
    '/src/services/park-state.js','/src/services/osm-client.js','/src/domain/parks/road-half-width.js','/src/domain/parks/classify-surface-tags.js','/src/domain/parks/impervious-geometry.js','/src/domain/parks/area.js','/src/domain/parks/resolve-park-area.js','/src/domain/parks/segment-intersection.js','/src/domain/parks/point-in-polygon.js','/src/domain/parks/bounds.js','/src/domain/parks/park-containment.js','/src/domain/parks/line-distance.js','/src/domain/parks/osm-rings.js','/src/domain/parks/rect-intersection.js','/src/domain/parks/cell-in-park.js','/src/domain/parks/cell-validity.js','/src/domain/parks/park-overlap.js','/src/services/park-geometry.js','/src/domain/parks/simplify-ring.js','/src/adapters/parks/park-geometry-store.js','/src/application/parks/persist-park-geometry.js','/src/services/geofence.js','/src/application/parks/find-park-candidates.js','/src/application/parks/fetch-detailed-coverage.js','/src/application/parks/classify-coverage-elements.js','/src/application/parks/find-nominatim-boundary.js','/src/adapters/parks/nominatim-client.js','/src/services/park-query.js','/src/domain/parks/identity.js','/src/domain/parks/is-schema-error.js','/src/adapters/parks/park-store.js','/src/application/parks/register-park.js','/src/adapters/parks/project-store.js','/src/application/parks/create-project.js','/src/adapters/parks/project-link-store.js','/src/application/parks/link-project.js','/src/application/parks/detect-park.js','/src/application/parks/create-manual-park.js','/src/adapters/parks/park-search.js','/src/application/parks/search-park-by-name.js','/src/services/park-registry.js','/src/application/parks/build-grid-waypoint-rows.js','/src/application/parks/count-grid-cell-measurements.js','/src/application/parks/build-grid-request.js','/src/application/parks/resolve-grid-waypoint-readiness.js','/src/application/parks/select-grid-waypoint-cells.js','/src/application/parks/prepare-grid-surface-parts.js','/src/application/parks/resolve-grid-cell-style.js','/src/application/parks/count-grid-cell-states.js','/src/application/parks/grid-review-signature.js','/src/application/parks/prepare-grid-waypoint-batch.js','/src/adapters/parks/fetch-latest-grid-waypoint.js','/src/adapters/parks/insert-grid-waypoints.js','/src/adapters/parks/fetch-grid-measurement-candidates.js','/src/domain/parks/grid-options.js','/src/domain/parks/grid-bounds.js','/src/domain/parks/grid-cell-shape.js','/src/ui/grid-summary.js','/src/ui/grid-waypoint-layer.js','/src/services/grid-engine.js','/src/ui/editor-ui.js','/src/ui/park-panel.js','/src/ui/park-export.js',
    '/src/services/dash.js',
    /* UI katmanı (Faz 1): index.html'in inline <script> bloğu bu dört modüle
     * taşındı — global state, toast, landing beyni ve kabuk önyüklemesi.
     * Yükleme sırası index.html'de de aynıdır: state → toast → landing → shell. */
    '/src/ui/gis-workspace.js', '/src/ui/gis-project-draft.js', '/src/ui/gis-export.js', '/src/ui/state.js', '/src/ui/toast.js', '/src/ui/landing.js', '/src/ui/shell.js',
    '/css/park-panel.css','/css/ui-standard.css','/css/gis-workspace.css',
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
        ).then(async () => { await clearCachedWebFonts(); return self.clients.claim(); })
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
    // Binary font files are served from the browser HTTP cache/network. Avoid
    // persisting a truncated WOFF response in CacheStorage and replaying it.
    if (url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(networkOnly(request));
        return;
    }

    // Turnstile sürümleri CacheStorage'dan tekrar oynatılmamalı.
    if (url.hostname === 'challenges.cloudflare.com') {
        event.respondWith(networkOnly(request));
        return;
    }

    if (url.hostname === 'fonts.googleapis.com') {
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
        // Bozuk HTTP önbelleğindeki font yanıtını tekrar kullanmayın.
        const options = new URL(request.url).hostname === 'fonts.gstatic.com'
            ? { cache: 'reload' } : undefined;
        return await fetch(request, options);
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function clearCachedWebFonts() {
    const cache = await caches.open(RUNTIME);
    const requests = await cache.keys();
    const fonts = requests.filter(request => {
        try { return new URL(request.url).hostname.includes('fonts.gstatic.com'); }
        catch (_) { return false; }
    });
    await Promise.all(fonts.map(request => cache.delete(request)));
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

console.log('[SW] 🌲 DendroGeo Service Worker v2.10 r74 — network-first app assets');
