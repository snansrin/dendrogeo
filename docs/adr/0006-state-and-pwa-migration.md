# ADR 0006: Feature-scoped state ve mevcut PWA sözleşmeleri

- Durum: Kabul edildi
- Tarih: 2026-10-13

## Bağlam

Öneri metni merkezi store, Proxy reaktivitesi, Background Sync ve yeni cache politikaları tavsiye ediyor. Kaynak incelemesi, genel uygulama store'u yerine global lexical state ile feature-specific parçaların karışımını gösterdi. `sw.js` ise cache partitioning, activation cleanup, rota bazlı stratejiler ve GET dışı yazma istekleri için network-only geçişi zaten uyguluyor. Worker güncelleme testi açık park akışında zorunlu sayfa reload'unu özellikle önlüyor.

## Karar

Yeni state yönetimi, bir alanın gerçek ortak durum ihtiyacına göre `getState/setState/subscribe` sunan feature-scoped store ile başlar. Store immutable snapshot veya sığ güncelleme sözleşmesini açıkça belirtir. Proxy tüm uygulamaya varsayılan olarak eklenmez; ES module ve `features/` taşıması ayrı, pilotlu bir migration kararıdır.

Service Worker rotaları semantiklerine göre belgelenir ve mevcut testlerle korunur. Supabase REST/Auth/RPC, STAC/COG ve yazma metotları CacheStorage dışında kalır. Güncelleme akışı açık park/form verisini kesmez; kullanıcıya güvenli yenileme deneyimi ancak `waiting` durumu ve açık kabul testleriyle eklenir. Background Sync bulunmayan destek olarak belgelenir; yeni API ancak mevcut kuyrukla uyumlu retry/idempotency tasarımı varsa eklenir.

## Sonuçlar

- Global state'i tek seferde taşımak gerekmez; eski değişkenler geçiş süresince façade olarak kalabilir.
- Cache stratejisi değişikliği, bir rota için kanıtlanmış sorun ve davranış testi gerektirir.
- Worker aktivasyonu ile açık sayfanın yaşam döngüsü ayrı konudur; worker aktif olsa da sekmeyi zorla yenilemek varsayılan değildir.
- Gözlemleme, hata raporu ve reaktivite veri sızıntısı/performans değerlendirmesi olmadan eklenmez.
