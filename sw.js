// ============================================================
// 🌲 DendroGeo Service Worker v1.0
// Çevrimdışı ölçüm senkronizasyonu + harita tile cache
// ============================================================

const CACHE_VERSION = 'dendrogeo-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const TILE_CACHE = `tiles-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const OFFLINE_URL = '/'; // Çevrimdışıyken gösterilecek sayfa

// Supabase yapılandırması (ana HTML ile aynı)
const SB_URL = "https://xjbpounwdxrhelmixvqm.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYnBvdW53ZHhyaGVsbWl4dnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMDA1NzIsImV4cCI6MjEwMzY3NjU3Mn0.Q5b4ys1TkyhMffGaN9bR9A3nr4L4-8G5UBJY4iC4Dkk";

// Cache'lenecek temel statik varlıklar
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/chart.js@4',
    'https://challenges.cloudflare.com/turnstile/v0/api.js'
];

// ============================================================
// 📦 INSTALL: Temel varlıkları cache'e al
// ============================================================
self.addEventListener('install', event => {
    console.log('[SW] Kuruluyor...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Temel varlıklar cache\'leniyor');
                // Hatalı olanlar kurulumu engellemesin
                return Promise.allSettled(
                    CORE_ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`[SW] Cache başarısız: ${url}`, err)
                        )
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================================
// 🧹 ACTIVATE: Eski cache'leri temizle, kontrolü al
// ============================================================
self.addEventListener('activate', event => {
    console.log('[SW] Aktifleştiriliyor...');
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys
                    .filter(key => 
                        key.startsWith('static-') || 
                        key.startsWith('tiles-') || 
                        key.startsWith('api-')
                    )
                    .filter(key => 
                        key !== STATIC_CACHE && 
                        key !== TILE_CACHE && 
                        key !== API_CACHE
                    )
                    .map(key => {
                        console.log(`[SW] Eski cache siliniyor: ${key}`);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ============================================================
// 🌐 FETCH: İstek stratejileri
// ============================================================
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Sadece GET isteklerini cache'le
    if (request.method !== 'GET') {
        // POST/PUT/DELETE istekleri ağa yönlendir
        return;
    }

    // 1️⃣ OpenStreetMap harita tile'ları → Cache-first (offline harita için)
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirst(request, TILE_CACHE, 30 * 24 * 60 * 60 * 1000)); // 30 gün
        return;
    }

    // 2️⃣ Statik CDN (jsdelivr, unpkg, googleapis) → Stale-while-revalidate
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

    // 3️⃣ Supabase API istekleri → Network-first (güncel veri önemli)
    if (url.hostname.includes('supabase.co')) {
        // Fotoğraf yükleme ve auth isteklerini cache'leme
        if (
            url.pathname.includes('/storage/v1/object/') ||
            url.pathname.includes('/auth/v1/') ||
            url.pathname.includes('/rest/v1/rpc/')
        ) {
            event.respondWith(networkOnly(request));
            return;
        }
        // GET okuma istekleri (ölçümler, profiller) → Network-first + cache fallback
        event.respondWith(networkFirst(request, API_CACHE, 5 * 60 * 1000)); // 5 dk
        return;
    }

    // 4️⃣ Nominatim (reverse geocoding) → Network-first
    if (url.hostname.includes('nominatim.openstreetmap.org')) {
        event.respondWith(networkFirst(request, API_CACHE, 24 * 60 * 60 * 1000)); // 1 gün
        return;
    }

    // 5️⃣ Diğer tüm istekler (HTML, sayfa navigasyonu) → Network-first + offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // 6️⃣ Diğer statik dosyalar → Stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ============================================================
// 📨 MESSAGE: Ana sayfadan gelen mesajlar (SYNC tetikleyici)
// ============================================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SYNC') {
        console.log('[SW] SYNC tetiklendi - offline kuyruk işleniyor');
        event.waitUntil(syncOfflineMeasurements());
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ============================================================
// 📶 ONLINE: Ağ geri geldiğinde otomatik senkronizasyon
// ============================================================
self.addEventListener('online', () => {
    console.log('[SW] Çevrimiçi olundu - senkronizasyon başlatılıyor');
    syncOfflineMeasurements();
});

// ============================================================
// 🔄 Arka plan senkronizasyonu (Background Sync API)
// ============================================================
self.addEventListener('sync', event => {
    if (event.tag === 'sync-measurements') {
        console.log('[SW] Background sync tetiklendi');
        event.waitUntil(syncOfflineMeasurements());
    }
});

// ============================================================
// 🎯 STRATEJİ FONKSİYONLARI
// ============================================================

// Cache-first: Önce cache'e bak, yoksa ağdan al ve cache'le
async function cacheFirst(request, cacheName, maxAge = null) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

// Network-first: Önce ağ, başarısızsa cache
async function networkFirst(request, cacheName, maxAge = null) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline', { 
            status: 503, 
            statusText: 'Offline - DendroGeo',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Stale-while-revalidate: Hemen cache'den döndür, arka planda güncelle
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

// Network-only: Hiç cache'leme
async function networkOnly(request) {
    try {
        return await fetch(request);
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================================
// 💾 INDEXEDDB: Offline ölçümleri yönetme
// ============================================================
function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('DendroGeoOffline', 1);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('measurements')) {
                db.createObjectStore('measurements', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

async function getOfflineMeasurements() {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('measurements', 'readonly');
        const store = tx.objectStore('measurements');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function deleteOfflineMeasurement(id) {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('measurements', 'readwrite');
        const store = tx.objectStore('measurements');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ============================================================
// 🔄 OFFLINE SENKRONİZASYON: Kuyruktaki ölçümleri yükle
// ============================================================
async function syncOfflineMeasurements() {
    try {
        const records = await getOfflineMeasurements();
        if (!records || records.length === 0) {
            console.log('[SW] Offline kuyruk boş');
            return;
        }
        
        console.log(`[SW] ${records.length} offline ölçüm senkronize ediliyor...`);
        
        for (const record of records) {
            try {
                const { data, token, apiKey } = record;
                
                // 1. Fotoğraf varsa yükle
                let photoUrl = null;
                let photoFile = null;
                
                if (data.photoBlob) {
                    const formData = new FormData();
                    formData.append('file', data.photoBlob);
                    
                    const uploadPath = `${data.owner}/${Date.now()}.jpg`;
                    const uploadUrl = `${SB_URL}/storage/v1/object/dendro-photos/${uploadPath}`;
                    
                    const uploadRes = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'apikey': apiKey,
                            'Content-Type': 'image/jpeg'
                        },
                        body: data.photoBlob
                    });
                    
                    if (uploadRes.ok) {
                        photoFile = `P${String(data.point_id).padStart(3, '0')}_M${data.measurement_no || 1}.JPG`;
                        photoUrl = `${SB_URL}/storage/v1/object/public/dendro-photos/${uploadPath}`;
                    }
                }
                
                // 2. Ölçümü Supabase'e kaydet
                const payload = { ...data };
                if (photoUrl) {
                    payload.photo_url = photoUrl;
                    payload.photo_file = photoFile;
                }
                delete payload.photoBlob;
                
                const insertUrl = `${SB_URL}/rest/v1/measurements`;
                const insertRes = await fetch(insertUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'apikey': apiKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (insertRes.ok || insertRes.status === 201) {
                    // Başarılı → kuyruktan sil
                    await deleteOfflineMeasurement(record.id);
                    console.log(`[SW] ✓ Ölçüm P${data.point_id} senkronize edildi`);
                } else {
                    console.warn(`[SW] ✗ Ölçüm P${data.point_id} başarısız: ${insertRes.status}`);
                    // Hata devam ederse kuyrukta kalır, sonraki online'da tekrar dener
                    break; // Token geçersiz olabilir, sonraki ölçümleri de deneme
                }
            } catch (err) {
                console.error('[SW] Senkronizasyon hatası:', err);
                break;
            }
        }
        
        // Tüm istemcilere bildirim gönder
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
            client.postMessage({ 
                type: 'SYNC_COMPLETE', 
                syncedCount: records.length 
            });
        });
        
    } catch (err) {
        console.error('[SW] Senkronizasyon süreci başarısız:', err);
    }
}

// ============================================================
// 🔔 PUSH BİLDİRİM (gelecek kullanım için)
// ============================================================
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'DendroGeo';
    const options = {
        body: data.body || 'Yeni bildirim',
        icon: '/icon.png',
        badge: '/icon.png',
        data: data.url || '/'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === event.notification.data && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data);
            }
        })
    );
});

console.log('[SW] 🌲 DendroGeo Service Worker yüklendi');
