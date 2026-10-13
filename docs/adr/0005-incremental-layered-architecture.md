# ADR 0005: Katmanlı mimariyi artımlı sürdürme

- Durum: Kabul edildi
- Tarih: 2026-10-13

## Bağlam

DendroGeo'nun tarayıcı uygulaması bundler olmadan klasik script'lerle yükleniyor. `partials/head.html` script sırasının kaynağı; `index.html` buradan üretiliyor ve `sw.js` çevrimdışı kullanılacak dosyaları ayrıca precache ediyor. Modüller `window.DG_*` adlarıyla uyumlu API yayımlıyor. `src/domain`, `src/application`, `src/adapters`, `src/ui`, `src/services`, `src/contracts` ve `src/workers` zaten geniş ve çalışan alan ayrımlarına sahip. `features/`, `ports/`, `platform/` veya teknoloji-öncelikli adapter kökleri şu anda gerçek klasörler değil.

Dosyaları bu öneri adlarıyla topluca taşımak, davranışa katkı sağlamadan script sırası, test yolu, service-worker listesi ve eski global çağrılarını aynı anda değiştirecektir. Öte yandan yalnızca klasör adına güvenmek, klasik script'lerde katman ihlalini önleyemez.

## Karar

Mevcut klasörler kanonik kabul edilir ve yeni modüller sorumluluk ile iş alanına göre yerleştirilir. Alan kuralları `domain/{trees,parks,surface,reports,...}`, use-case'ler `application/{alan}`, dış erişim `adapters/{alan}` ve DOM/sunum `ui/` altında tutulur. `services/` yalnızca mevcut global API'leri koruyan facade/composition alanıdır. Callback nesneleri application portlarını ifade eder; ortak, isimli port sözleşmesi ihtiyacı doğana kadar ayrı `ports/` klasörü açılmaz. Runtime DTO doğrulaması `contracts/` altında kalır.

Yeni değişiklikler klasik script yükleme düzenini sürdürür. Her yeni script `partials/head.html` içine bağımlılık sırasıyla eklenir, derlenen `index.html` güncellenir ve çevrimdışı gereken dosya `sw.js` precache listesine alınır. Kilitli dosya modülerleştirilecekse orijinal API ve inline fallback korunur, ilgili lock manifest hash'i kaydedilir ve regresyon testleri değiştirilmez.

## Sonuçlar

- Artımlı değişiklikler mevcut çalışan uygulama biçimiyle uyumlu kalır; bundler veya toplu dosya taşıması gerekmez.
- `scripts/check-architecture.mjs`, domain içindeki doğrudan altyapı ve üst katman erişimini, application içindeki doğrudan Supabase/Leaflet/global fetch ve adapter/UI erişimini denetler.
- UI/controller kodunun bir kısmının application altında bulunması tarihsel durumdur; yeni DOM/harita etkileşimi `ui/` altında başlar. Eski dosyalar yalnız davranış ve yükleme etkisi ayrı doğrulanınca taşınır.
- İş alanı klasörleri mevcut terimleri korur: LULC ve Sentinel-2 `surface/`, ölçüm ve allometri `trees/`, park kimliği/geometri `parks/` altında kalır. Aynı kavrama ikinci adla klasör açılmaz.
- Testler keşif betiği ve kaynak-konumu kilitleri nedeniyle kök `test/` altında kalır; dosya adı katmanı ve kullanım senaryosunu belirtir.
- Statik `en/` sayfaları ve çalışma zamanı `config/i18n*.js` sözlüğü ayrı görevleri sürdürür.

## Sonraki aşamalar

1. Yeni modüllerde callback enjeksiyonunu ve mimari kural CI denetimini kullan.
2. Büyük locked service facade'larını küçük domain/application/adapter/ui sorumluluklarına davranışı koruyarak ayır.
3. Aynı test ve çağrı sınırına sahip UI dosyaları çoğalırsa, yükleme/precache etkisiyle birlikte `ui/{pages,components,pwa}` alt dizinini değerlendir.
4. ES module/build geçişi ayrı ADR, üretim önizlemesi, offline paketi ve geri dönüş planı gerektirir; bu karar bundler'a geçiş yetkisi vermez.
