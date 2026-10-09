# DendroGeo modüler mimari

## Sınırlar

- `domain/`: saf bilimsel ve coğrafi kurallar. DOM, Leaflet, ağ, Supabase ve kalıcı durum kullanmaz.
- `application/`: bir kullanıcı işini baştan sona yürütür. Gerekli servisleri işlev bağımlılıkları olarak alır; doğrudan dış servis çağırmaz.
- `ports/`: application katmanının beklediği veri ve servis sözleşmeleri. Adapter değişse de use-case sözleşmesi aynı kalır.
- `adapters/`: STAC/COG, OSM, Supabase, IndexedDB, Leaflet ve dosya biçimleriyle konuşur.
- `features/`: ekran, etkileşim ve görünüm modeli. Hesap kurallarını içermez.
- `workers/`: uzun raster, geometri ve grid işleri. Mesajları sürümlü ve doğrulanmış DTO'lardır.
- `bootstrap/`: bağımlılıkları bir kez kurar ve özellikleri başlatır.
- `compatibility/`: klasik script ve `window.DG_*` çağrıları kaldırılana kadar geçici geriye uyum katmanı.

Bağımlılıklar `features → application → domain` yönünde ilerler. Application dış kaynakları yalnızca port sözleşmeleri üzerinden kullanır; adapter'lar bu portları uygular. Domain ve application birbirinden bağımsız test edilebilir.

## Hedef ağaç

```text
src/
├── bootstrap/                 # composition root ve başlangıç
├── features/
│   ├── park-analysis/         # tek yüzey analizi ekranı
│   ├── parks/                 # park seçimi ve park akışı
│   ├── gis-workspace/         # katmanlar ve çizim araçları
│   ├── inventory/             # ağaç/saha ekranları
│   └── reports/               # rapor ve yayın ekranları
├── application/
│   ├── surface/               # tara, düzelt, kabul et, grid üret
│   ├── trees/                 # ölçüm ve karbon use-case'leri
│   ├── parks/                 # park use-case'leri
│   ├── reports/               # rapor snapshot/yayın akışı
│   └── offline/               # kuyruk ve eşitleme
├── domain/
│   ├── surface/               # sınıflar, geometri ve kalite kuralları
│   ├── gis/                   # CRS, alan ve grid kuralları
│   ├── trees/                 # ölçüm ve allometri kuralları
│   └── reports/               # değişmez kabul sonucu
├── ports/                     # veri ve servis arayüzleri
├── adapters/                  # raster, OSM, Supabase, IndexedDB, Leaflet, export
├── workers/                   # raster, geometri ve grid işleri
├── contracts/                 # sürümlü, çalışma anında doğrulanan DTO'lar
├── platform/                  # zaman aşımı, kuyruk, iptal ve tanılama
└── compatibility/             # geçiş sırasında legacy window API
```

## Uygulanmış ilk ayrım

- `domain/trees/allometry.js`, Chave allometrisi, karbon katsayıları ve hacim denklemini saf fonksiyon olarak taşır.
- `application/trees/calculate-tree-carbon.js`, yoğunluk çözümünü enjekte edilen bağımlılık olarak alır ve domain hesabını çağırır.
- `application/trees/calculate-tree-carbon-from-circumference.js`, kilitli çevre/DBH protokolünü ve karbon akışını enjekte edilen portlarla sıralar; saha API'si korunur.
- `application/trees/validate-measurement.js`, proje/nokta/ölçüm numarası ile grup/tür/çevre/boy kapısının sırasını yönetir; limitleri kopyalamaz, yoğunluk ve ölçüm protokolü adapter'larına sorar.
- `domain/trees/photo-quality.js`, kalibre piksel sınıflandırmasını ve fotoğraf kanıtı kararını saf fonksiyonlar olarak tutar; canvas, DOM ve form durumuna erişmez.
- `application/reports/collect-publication-request.js`, kullanıcı tarafından onaylanan yayın isteğinin tekilleştirme, künye toplama ve ekleme sırasını bağımlılık enjeksiyonuyla yürütür; Supabase ve modal uygulama servisinde kalır.
- `domain/reports/report-context.js`, bibliyografik künye temizleme, ORCID ve tarih doğrulama kurallarını saf fonksiyonlarda tutar; `core/report-context.js` eski global API için uyumluluk köprüsüdür.
- `scripts/lib/canonical-hash.mjs`, rapor snapshot'ları ve yayın dosyaları için kanonik JSON + SHA-256 üretir; `mc.mjs` eski importlar için bu API'yi yeniden dışa aktarır.
- `scripts/lib/report-provenance.mjs`, rapor snapshot'ının sabit provenance alanlarını saf biçimde kurar; sürüm, Git, ölçüm protokolü ve LULC değerlerini mevcut üretici yetkili kaynaklarından verir.
- `scripts/lib/report-metadata.mjs`, DOI, DataCite uyumlu kimlikler, yazarlar, yöntem, QA beyanı ve rapor ilişkilerini yalnızca snapshot + açık politika bağımlılıklarıyla üretir; dosya/ağ erişimi yoktur.
- `scripts/lib/report-geometry.mjs`, rapor kapsamındaki nokta-poligon testi, halka kesişimi, bbox tanısı ve jeodezik alan yardımcılarını saf fonksiyonlarda tutar; `make-report.mjs` eski API adlarını dışa aktarmayı sürdürür.
- `scripts/lib/report-export.mjs`, kabul edilmiş rapor satırlarını aynı CSV başlığı/BOM ve GeoJSON koordinat sırasıyla serileştirir; güven aralığı hesaplayıcısını bağımlılık olarak alır ve snapshot'ı değiştirmez.
- `scripts/lib/report-archive.mjs`, DGR sıra numarası, park yayın geçmişi ve değişmez rapor klasörlerinden yeniden oluşturulan HTML dizinini yönetir; `make-report.mjs` çağrı uyumluluğunu korur.
- `scripts/lib/report-inventory-qa.mjs`, envanter satırlarını kilitli ölçüm ve karbon kurallarıyla denetler; yayın üreticisinden bağımsızdır ve `make-report.mjs` eski dışa aktarımını korur.
- `scripts/lib/report-formatting.mjs`, raporlardaki yazar atfı, Türkçe tarih ve EPSG etiketlerini saf yardımcılar olarak üretir; `make-report.mjs` aynı API'leri dışa aktarır.
- `scripts/lib/report-retraction.mjs`, geri çekilmiş DGR'ler için kişisel/veri içeriği sızdırmayan bildirim HTML'ini üretir; `make-report.mjs` site künyesini bağlayıp eski fonksiyon API'sini korur.
- `scripts/lib/report-qr.mjs`, isteğe bağlı QR kütüphanesini SVG data-URI adapter'ına bağlar; QR üretilemese bile rapor bağlantısının kalmasını sağlayan `null` davranışını korur.
- `scripts/lib/report-map.mjs`, kabul edilmiş rapor yüzeyini sabit piksel kurallarıyla PNG'ye çizer; `make-report.mjs` eski `mapCanvas`, `renderMapPNG` ve `MAP_TONES` API'lerini korur.
- `scripts/lib/report-author.mjs`, rapor yazarını veri sahibi → son yayın isteği sırasıyla çözer; `make-report.mjs` mevcut REST adapter'ını enjekte eder ve yayın künyesi önceliğini korur.
- `scripts/lib/report-share.mjs`, dondurulmuş rapor sayfasının yerel paylaşım/pano/yazılı kopya akışını taşır; `make-report.mjs` aynı satır içi tarayıcı fonksiyonunu şablona ekler.
- `scripts/lib/report-style.mjs`, rapor sayfasının masaüstü, mobil ve yazdırma CSS'ini tek sorumlulukta üretir; yalnız sayfa kimliğini güvenli biçimde yazdırma alt bilgisine bağlar.
- `scripts/lib/report-measurement-summary.mjs`, onaylı ölçümlerden toplam/tür/GPS/dönem/moderasyon özetini üretir; Monte Carlo fonksiyonlarını enjekte edilmiş olarak kullanır ve `make-report.mjs` snapshot alan sırasını korur.
- `services/allometry.js`, eski `calc()` ve `calcFromCircumference()` çağrılarını koruyan adapter'dır. DBH/çevre giriş sözleşmesini ve tür yoğunluğu kaynağını değiştirerek yeni ekran/API gerektirmez.
- `services/measure.js`, mevcut saha formu, hata mesajı ve kayıt davranışını koruyup doğrulama ve fotoğraf kalite modüllerini bağlayan adapter'dır.
- `services/academic-profile.js`, akademik profil arayüzü ve eski global yayın isteği çağrısını koruyup istek use-case'ini bağlayan adapter'dır.
- `domain/surface/quality-gates.js`, park-raster kapsama farkı kuralını tek başına sınar.
- `application/surface/run-analysis.js`, girdiyi doğrular, tek birincil kaynağı çalıştırır, kapsama kapısını uygular ve rapor DTO'sunu üretir. DOM, ağ ve kalıcı kayıt kullanmaz.
- `services/landcover.js`, `DG_LANDCOVER` global API'sini koruyan geçiş adapter'ıdır; use-case'i bağlar, eski katmanı çizer ve son sonucu tutar.
- `domain/surface/merge-tile-results.js`, bağımsız raster karo sonuçlarının alan, sınıf sayacı, ham kod, run ve hücre listelerini deterministik toplar; ağ, raster okuma, sınıflandırma ve geometri hesaplamaz. `lc-engine.js` eski `dgLcMergeTileResults` adını geçiş adapter'ı olarak sunar.
- `domain/surface/classify-landcover-code.js`, ESA/io-lulc ham kodlarını rapor gruplarına eşler ve kaynak bazlı NoData kararını verir; sınıf haritasını yapılandırmadan alır ve saf fonksiyon API'si sunar.
- `domain/surface/compare-source-class-areas.js`, iki kaynağın sınıf alanlarını yalnızca uzlaşma göstergesi olarak karşılaştırır; sınıf kararlarını değiştirmez ve güven skoru iddiası taşımaz.
- `adapters/surface/result-exports.js`, değişmez analiz DTO'sunu CSV ve GeoJSON biçimlerine çevirir; sınıf sözlüğünü yükleme anında alır. `lc-engine.js` eski dışa aktarma fonksiyon adlarını korur.
- `application/surface/analyze-source.js`, STAC/SAS portlarıyla kaynak taramasını, karo tekilleştirme ve paralel iş sırasını, iptali ve birleştirmeyi yönetir; raster sınıflandırma ve geometri kurallarına sahip değildir.
- `adapters/surface/process-landcover-tile.js`, tek COG karosunu okur ve park geometrisiyle gerçek hücre kesişimini kurar; raster/CRS/geometri/classification bağımlılıkları yükleme anında bağlanır ve eski `dgLcProcessTile` API'si servis adapterında korunur.
- `domain/surface/patch-geometry.js`, hücre kümesinden yüzey nesnesi halkası çıkarımı, halka alan/merkez hesabı, yalnız görsel yumuşatma ve nokta-halka testini saf fonksiyonlarda tutar. `domain/surface/group-patch-cells.js`, aynı sınıftaki 4-komşulu hücre bileşenlerini deterministik sırayla gruplar; alan eşiği ve çizim kararı vermez. `domain/surface/measure-patch-components.js`, verilen hücre alanlarını değiştirmeden bileşen alanı, alan ağırlıklı merkez ve mevcut minimum alan eşiğini özetler. `domain/surface/query-green-patches.js`, açık patch listesi ve geometri callback’iyle yeşil nokta/nesne sorgular; son analiz durumunu okumaz. `lc-patches.js` eski global fonksiyon adlarını ince uyumluluk sarmalayıcılarıyla korur.
- Yeni dosyalar analiz zincirine sürümlü lazy loader ve service worker precache üzerinden eklenmiştir.

Bu ayrım raster sınıflandırma kodlarını, kaynak eşlemesini, eşikleri, Sentinel/OSM inceleme davranışını veya alan hesabı formüllerini değiştirmez. Kabul edilen rapor ve Supabase şeması değişmemiştir.

## Güvenli geçiş sırası

1. Önce tek bir bounded use-case'i ayır; eski global çağrı sözleşmesini adapter'da koru.
2. Saf kuralları domain'e çıkar ve altın değer/regresyon testleriyle aynı sayıları doğrula.
3. Bir use-case'in tüm dış bağımlılıklarını portlara bağla; UI ve servis dosyaları doğrudan birbirinin durumunu okumamalı.
4. Raster/geometri/grid işleri worker mesaj sözleşmesine taşınmalı; iş kimliği, iptal ve aşama hataları korunmalı.
5. Ölçüm, park, rapor, çevrimdışı kayıt ve harita özelliklerini aynı sırayla ayrı ayrı taşı.
6. Her aşamada `npm run check`, ilgili saha/park fixture'ları ve 320/360/390/430 px mobil testleri geçmeden sonraki sınırı değiştirme.
7. Tüm çağrılar açık modül arayüzlerine taşındıktan sonra classic global köprüsünü kaldır; bunu tek seferde yapma.

## Modül kabul ölçütü

Her modülün tek bir dış API'si, sahibi olduğu açık durumu ve kendi testleri bulunmalı. Başka modülün iç değişkenine erişim yerine DTO/port kullanmalı. Network hatası, worker çökmesi, bozuk geometri, eksik sınıf kanıtı ve yeniden deneme ayrı testlerle doğrulanmalı. Kalite kapısını geçmeyen analiz yayınlanmamalı; ölçülmeyen kesinlik veya sıfır hata iddiası üretilmemeli.
