# DendroGeo mimari değerlendirmesi

**Tarih:** 14 Ekim 2026
**Kapsam:** Kaynak kod, script yükleme sırası, Service Worker, çevrimdışı kuyruk, lazy loading, testler ve mimari CI denetimi.

Bu değerlendirme, öneri metnindeki varsayımları gerçek kaynakla karşılaştırır. DendroGeo için hedef; çalışan saha, RLS ve çevrimdışı davranışları koruyarak modül sınırlarını görünür kılmak ve geçişleri küçük, geri alınabilir gruplarda yapmaktır.

## Kanıta dayalı mevcut durum

| Alan | Kaynaktaki durum | Mimari kararı |
|---|---|---|
| Modül düzeni | `src/domain`, `src/application`, `src/adapters`, `src/ui`, `src/contracts` ve `src/workers` mevcut. `domain/trees`, `application/trees` gibi alan klasörleri var. | Mevcut alan + katman düzeni kanonik kalır. Yeni proje modülleri ilgili katmana ve `trees/` gibi alana eklenir. |
| Tarayıcı yükleme biçimi | `partials/head.html`, `defer` ile klasik script'leri sıralar; `index.html` bu parçalardan üretilir. Modüller `window.DG_*` API yayımlar. `package.json` içindeki `type: module`, Node araçlarını etkiler; tarayıcı script'lerini ES module yapmaz. | Gerçek import/export geçişi ayrı ADR, pilot ve geri dönüş planı ister. Paket alanını değiştirmek tek başına tarayıcı mimarisini dönüştürmez. |
| Bağımlılık yönü | `scripts/check-dependency-rules.mjs` domain/application içindeki `window.DG_*` çapraz katman erişimlerini ve application/UI içindeki doğrudan Supabase `.from()` çağrılarını tarar. Admin, Turnstile, measurement marker ve waypoint GPS overlay use-case'leri UI/adapter bağımlılıklarını injected port olarak alır. Landing view okumaları `world-stats-store.js`; shell/auth profil ve oturum okumaları `auth/session-store.js`; admin sorguları ve fotoğraf Storage işleri `admin-persistence-store.js` üzerinden geçer. | Denetimi her `npm run check` içinde tut; çapraz katman ve persistence geçiş borçlarını sıfırda koru, toplu `features/` taşıması yapma. |
| RLS yazma sınırı | Park geometri backfill ve admin ölçüm/fotoğraf işlemleri adapter store'larında; application use-case'leri query builder veya Storage API bilmez. Yetki ve veri görünürlüğü Supabase policy'lerinde kalır. | Supabase sorgularını adapter'da, alan kararını domain'de, orkestrasyonu application'da, kullanıcı sunumunu UI'da tut. |
| Şema hatası sınırı | Domain yalnız gerçek Postgres/PostgREST eksiklerini sınıflandırır; application handler geçici yetki/ağ hatasında park kapısını açık tutar, UI feedback doğru migration uyarısını verir. | RLS/bağlantı hatalarını kalıcı şema durumu yapma; modül kapısını kilitli `DG_PARK_SCHEMA_OK` ile eşle. |
| Durum | `src/ui/state.js` içinde `USER`, `GPS`, `PROJ_LIST`, `EDIT_PROJ` ve `map` gibi uygulama genelinde paylaşılan lexical değişkenler bulunuyor. Grid için `DG_GRID_SESSION_STATE.create()` adlı sınırlı factory ve yeni ölçüm proje dizini için `getState/setState/subscribe` sunan feature-scoped store var; tüm uygulama için ortak store yok. `localStorage` cihaz tercihleri, IndexedDB çevrimdışı ölçüm kuyruğu ve LULC doğrulama kampanyası için kullanılıyor. | Genel amaçlı, Proxy tabanlı store'u tüm uygulamaya yayma. Yeni ölçüm proje store'u ilk alana özel pilot; `PROJ_LIST` uyumluluk görünümü olarak store'dan eşitlenir. Proxy ancak ölçülmüş ihtiyaç ve render kapsamı varsa değerlendirilsin. |
| Service Worker önbelleği | Gerçek dosya `sw.js`. `CACHE_VERSION` ile `precache/runtime/tiles/api/images` ayrılıyor; `activate` eski sürümlü cache'leri siliyor. Navigasyon ağdan okunup ağ yoksa precache başlangıç sayfasına dönüyor. Uygulama JS/CSS network-first + bounded runtime cache ve precache yedeği; OSM tile ve public Supabase fotoğrafı cache-first/limitli; Google Fonts CSS genel olarak stale-while-revalidate; Nominatim network-first; STAC/COG, font binary, Turnstile network-only. Supabase REST/Auth/RPC CacheStorage'a alınmadan doğrudan ağa geçiyor. Fetch dinleyicisi yalnız GET'i karşılıyor; POST/PUT/DELETE istekleri SW tarafından cache'lenmiyor. | Mevcut stratejiler seçicidir; tüm API'leri stale-while-revalidate yapmak veri/RLS davranışına uygun olmaz. Politika bu tabloyla belgelenir ve mevcut rota testleri korunur. |
| Worker güncellemesi | `src/ui/shell.js` worker'ı `updateViaCache: 'none'` ile kaydedip `registration.update()` çağırır. Yeni worker install sırasında `skipWaiting()`, activate sırasında eski cache temizliği ve `clients.claim()` çalıştırır. Mesajla `SKIP_WAITING` de desteklenir. Aktif sayfayı `controllerchange` ile zorunlu yenileyen bir dinleyici yok; `test/shell-worker-update.test.mjs` açık park akışının kesilmemesini doğrular. | Saha analizi veya formu açıkken zorunlu reload ekleme. Güncelleme bildirimi/yenileme kontrolü gerekiyorsa önce bekleyen worker durumunu gösteren, kullanıcının veri güvenli anında kabul ettiği ayrı UX ve test tasarla. |
| Lazy loading | `src/utils/lazylibs.js`, GeoTIFF ve Chart.js'i ihtiyaç anında yükler; LULC script zincirini sıralı ve hatadan devam edebilir kurar. Turnstile ve landing haritası için `IntersectionObserver` kullanılır; destek yoksa doğrudan yedek akış vardır. | Bu performans yaklaşımını koru. Yeni ağır modül, çağrı noktası ve retry testiyle lazy zincire eklenir. |
| Çevrimdışı veri | IndexedDB tabanlı ölçüm kuyruğu vardır; online olduğunda sync tetiklenir ve durum rozeti gösterilir. `navigator.storage.persist()` istenir. Background Sync kullanımına dair kaynak kanıtı yoktur. | Background Sync'i varsayma; mevcut online/visibility retry akışını ve kuyruk idempotency'sini koru. API desteği ve tekrar deneme semantiği ayrı test edilmeden ekleme. |
| Hata sınırları | Hatalar çoğunlukla ilgili use-case veya servis içinde yakalanıyor; merkezi `error`/`unhandledrejection` gözlemcisi görünmüyor. | Global dinleyici eklemek tek başına hata sınırı değildir. Önce kişisel/veri içeriklerini loglamayan rapor biçimini ve kullanıcıya güvenli geri dönüşü belirle; sonra isteğe bağlı gözlemciyi test et. |
| Güvenlik ve dağıtım | `index.html` CSP meta politikası içeriyor; `scripts/check-csp.mjs` dış origin kapsamını test ediyor. GitHub Pages HTTPS kullanımı proje yayın adresi ve canonical URL'lerle yapılandırılmış. | Manifest ve CSP denetimleri devam eder. Worker/API istekleri güvenlik kararını zayıflatacak biçimde cache'lenmez. |

## Hedef mimari

```text
Browser entry: partials/head.html → generated index.html
         │
         ├── ui/            DOM, form, harita ve sunum
         ├── application/   use-case sırası ve feature-scoped state
         ├── domain/        saf kurallar ve dönüşümler
         └── adapters/      Supabase, HTTP, IndexedDB ve tarayıcı dış erişimi

services/  legacy window.DG_* facade + composition root
contracts/ sınır DTO doğrulaması          workers/ uzun işler
sw.js      route bazlı, test edilen offline ve cache politikası
```

Yeni alanlar için bağımlılık akışı `ui/services → application → domain`; dış erişim application'a enjekte edilen adapter callback'lerinden geçer. Gerekli birden fazla görünüm durum paylaşıyorsa feature-scoped `getState/setState/subscribe` store kullanılır. Tek kullanıcılı bir akış için merkezi uygulama store'u gerekmez. `features/{...}` ağacı ancak bir özelliğin sayfa girişi, state'i, UI'ı, use-case'leri ve adapter'ları birlikte taşınabiliyor ve statik script/worker/test referansları topluca doğrulanabiliyorsa açılır.

## Uygulama sırası

1. Mimari kararları, gerçek script yükleme biçimini, cache tablosunu ve mevcut testleri belgeleyip CI'da sınır denetimini sürdür. Bu başlangıç eklendi.
2. Kilitli servisleri davranış ve hash kaydıyla beş yeni sorumluluk modülüne ayır; her grup için focused test, tam `npm run check`, PR, CI ve `main` merge yap.
3. Modül sınırı net olan her alan için tek kaynaklı state/store'u küçük pilotla oluştur. Eski global adlar store'a bağlanan uyumluluk cephesi olarak kalır; Proxy zorunlu değildir.
4. PWA politikalarını mevcut testlerle koru. SW değişikliği, spesifik bir stale/çevrimdışı hatayı düzelttiği ve açık akışları bozmadığı zaman yapılır; genel strateji dönüşümü yapılmaz.
5. Feature-first veya native ES module geçişini yalnız pilot; build, offline precache, CSP, lazy yükleme, test ve geri dönüş koşullarını birlikte karşılarsa başlat.
6. Global hata gözlemleme, custom event iletişimi ve performans bütçelerini kişisel veri koruması ve ölçüm ihtiyacı belirlendikten sonra dar kapsamla ekle.

Bu sıra, ideal yapıyı mevcut sistemin çalışır sözleşmelerine göre kurar. Her taşınan modülün sahibi, callback sözleşmesi, yükleme yeri, offline davranışı ve kilitli regresyonları aynı PR içinde görünür olur.
