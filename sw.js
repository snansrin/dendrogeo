// ============================================================
// 🌲 DendroGeo Service Worker v2.0 (Production-Ready)
// Çevrimdışı ölçüm senkronizasyonu, harita tile cache, 
// fotoğraf cache, LRU temizliği ve gelişmiş ağ stratejileri
// ============================================================

const CACHE_VERSION = 'dendrogeo-sw-v2-r2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const TILE_CACHE = `tiles-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMG_CACHE = `images-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// Supabase yapılandırması (Acil durum/fallback için)
const SB_URL = "https://xjbpounwdxrhelmixvqm.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYnBvdW53ZHhyaGVsbWl4dnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMDA1NzIsImV4cCI6MjEwMzY3NjU3Mn0.Q5b4ys1TkyhMffGaN9bR9A3nr4L4-8G5UBJY4iC4Dkk";

// 🛡️ Cache Limitleri (Cihaz depolamasının şişmesini önlemek için LRU mantığı)
const MAX_TILES = 2000;   // Maksimum 2000 harita parçası
const MAX_IMAGES = 500;   // Maksimum 500 ağaç fotoğrafı
const MAX_API_CACHE = 150; // Maksimum 150 API yanıtı

// Cache'lenecek temel statik varlıklar (App Shell)
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.png',
    '/social-preview.png',
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

// ============================================================
// 📦 INSTALL: Temel varlıkları cache'e al
// ============================================================
self.addEventListener('install', event => {
    console.log('[SW] 🌲 Kuruluyor...');
    self.skipWaiting(); // Hemen aktif ol
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Temel varlıklar cache\'leniyor');
                // Hatalı olanlar kurulumu engellemesin (Promise.allSettled)
                return Promise.allSettled(
                    CORE_ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`[SW] Cache başarısız: ${url}`, err)
                        )
                    )
                );
            })
    );
});

// ============================================================
// 🧹 ACTIVATE: Eski cache'leri temizle, kontrolü al
// ============================================================
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
        ).then(() => self.clients.claim()) // Tüm sekmelerin kontrolünü hemen al
    );
});

// ============================================================
// 🌐 FETCH: İstek stratejileri
// ============================================================
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return; // Sadece GET isteklerini cache'le

    const url = new URL(request.url);

    // 1️⃣ OpenStreetMap harita tile'ları → Cache-first (LRU Temizlikli)
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirstWithLimit(request, TILE_CACHE, MAX_TILES));
        return;
    }

    // 2️⃣ Statik CDN (jsdelivr, unpkg, googleapis, turnstile) → Stale-while-revalidate
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

    // 3️⃣ Supabase API & Storage İstekleri
    if (url.hostname.includes('supabase.co')) {
        // Fotoğraf indirmeleri (Storage Public) → Cache-first (LRU Temizlikli)
        if (url.pathname.includes('/storage/v1/object/public/')) {
            event.respondWith(cacheFirstWithLimit(request, IMG_CACHE, MAX_IMAGES));
            return;
        }
        
        // Auth, RPC ve Upload isteklerini ASLA cache'leme (Network Only)
        if (
            url.pathname.includes('/auth/v1/') ||
            url.pathname.includes('/rest/v1/rpc/') ||
            url.pathname.includes('/storage/v1/object/') && request.method !== 'GET'
        ) {
            event.respondWith(networkOnly(request));
            return;
        }
        
        // GET okuma istekleri (ölçümler, profiller) → Network-first + cache fallback
        event.respondWith(networkFirstWithLimit(request, API_CACHE, MAX_API_CACHE));
        return;
    }

    // 4️⃣ Nominatim (Reverse Geocoding) → Network-first
    if (url.hostname.includes('nominatim.openstreetmap.org')) {
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    // 5️⃣ Sayfa Navigasyonu (HTML) → Network-first + Offline Fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Başarılıysa cache'i güncelle
                    const responseClone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, responseClone));
                    return response;
                })
                .catch(() => caches.match(OFFLINE_URL).then(res => res || caches.match('/index.html')))
        );
        return;
    }

    // 6️⃣ Diğer tüm statik dosyalar → Stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ============================================================
// 📨 MESSAGE: Ana sayfadan gelen mesajlar (SYNC tetikleyici)
// ============================================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SYNC') {
        console.log('[SW] 🔄 Manuel SYNC tetiklendi');
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
    console.log('[SW] 🌐 Çevrimiçi olundu - Arka plan senkronizasyonu başlatılıyor');
    syncOfflineMeasurements();
});

// ============================================================
// 🔄 Arka plan senkronizasyonu (Background Sync API - Chrome/Edge)
// ============================================================
self.addEventListener('sync', event => {
    if (event.tag === 'sync-measurements') {
        console.log('[SW] ⚙️ Background Sync API tetiklendi');
        event.waitUntil(syncOfflineMeasurements());
    }
});

// ============================================================
// 🎯 STRATEJİ FONKSİYONLARI (LRU Destekli)
// ============================================================

// Cache-first + LRU Limit (Harita ve Fotoğraflar için)
async function cacheFirstWithLimit(request, cacheName, limit) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
            await trimCache(cacheName, limit); // LRU Temizliği
        }
        return response;
    } catch (err) {
        return new Response('Offline Content', { status: 503, statusText: 'Offline' });
    }
}

// Network-first + LRU Limit (API için)
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
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Network-first (Limit yok)
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

// Stale-while-revalidate (CDN için)
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

// Network-only (Auth/Upload için)
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

// 🧹 LRU Cache Temizleme Fonksiyonu (Eski kayıtları siler)
async function trimCache(cacheName, limit) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > limit) {
        // En eski kaydı sil (İlk eklenen)
        await cache.delete(keys[0]);
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
            console.log('[SW] ✅ Offline kuyruk boş.');
            return;
        }
        
        console.log(`[SW] 🚀 ${records.length} offline ölçüm senkronize ediliyor...`);
        let syncedCount = 0;
        
        for (const record of records) {
            try {
                const { data, token, apiKey } = record;
                
                // ⚠️ Token süresi dolmuşsa senkronizasyonu durdur, kullanıcıya haber ver
                if (!token) {
                    notifyClients({ type: 'AUTH_EXPIRED', message: 'Oturum süresi dolmuş, lütfen tekrar giriş yapın.' });
                    break;
                }

                // 1. Fotoğraf varsa Supabase Storage'a yükle
                let photoUrl = null;
                let photoFile = null;
                
                if (data.photoBlob) {
                    const uploadPath = `${data.owner}/${Date.now()}_${record.id}.jpg`;
                    const uploadUrl = `${SB_URL}/storage/v1/object/dendro-photos/${uploadPath}`;
                    
                    const uploadRes = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'apikey': apiKey,
                            'Content-Type': data.photoBlob.type || 'image/jpeg',
                            'x-upsert': 'false'
                        },
                        body: data.photoBlob
                    });
                    
                    if (uploadRes.ok) {
                        photoFile = `P${String(data.point_id).padStart(3, '0')}_M${data.measurement_no || 1}.JPG`;
                        photoUrl = `${SB_URL}/storage/v1/object/public/dendro-photos/${uploadPath}`;
                    } else if (uploadRes.status === 401) {
                        notifyClients({ type: 'AUTH_EXPIRED' });
                        break;
                    } else {
                        console.warn(`[SW] ⚠️ Fotoğraf yükleme başarısız: ${uploadRes.status}`);
                        continue; // Fotoğraf yüklenemezse ölçümü de gönderme, kuyrukta kalsın
                    }
                }
                
                // 2. Ölçüm Metadata'sını Supabase REST API'ye kaydet
                const payload = { ...data };
                if (photoUrl) {
                    payload.photo_url = photoUrl;
                    payload.photo_file = photoFile;
                }
                delete payload.photoBlob; // Blob veritabanına gitmez
                
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
                    syncedCount++;
                    console.log(`[SW] ✅ Ölçüm P${data.point_id} senkronize edildi`);
                } else if (insertRes.status === 401) {
                    notifyClients({ type: 'AUTH_EXPIRED' });
                    break;
                } else {
                    console.warn(`[SW] ❌ Ölçüm P${data.point_id} başarısız: ${insertRes.status}`);
                    break; // Veri bütünlüğü için sırayı bozma, sonraki online'da tekrar dener
                }
            } catch (err) {
                console.error('[SW] Senkronizasyon ağ hatası:', err);
                break; // Ağ tekrar gidene kadar bekle
            }
        }
        
        // Tüm istemcilere (sekmelere) bildirim gönder
        notifyClients({ 
            type: 'SYNC_COMPLETE', 
            syncedCount: syncedCount,
            remaining: records.length - syncedCount
        });
        
    } catch (err) {
        console.error('[SW] Senkronizasyon süreci kritik hatası:', err);
    }
}

// Yardımcı: İstemcilere mesaj gönderme
async function notifyClients(message) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
        client.postMessage(message);
    });
}

// ============================================================
// 🔔 PUSH BİLDİRİM (Gelecek Kullanım / Admin Onayları)
// ============================================================
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    const title = data.title || 'DendroGeo Bildirim';
    const options = {
        body: data.body || 'Yeni bir güncelleme var.',
        icon: '/icon.png',
        badge: '/icon.png',
        data: data.url || '/',
        vibrate: [100, 50, 100]
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

console.log('[SW] 🌲 DendroGeo Service Worker v2.0 Yüklendi ve Hazır.');
