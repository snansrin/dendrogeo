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
- `contracts/surface-analysis.js`, raster hücresi, analiz sonucu, patch, kaynak kanıtı, analiz çıktısı ve hata DTO'larının çalışma anı şekil denetimini yapar. `run-analysis.js` önce mevcut kapsama kalite kapısını uygular, sonra birincil kaynak kanıtını ve dönen DTO'yu doğrular; sözleşme hatası sınıf/alan sonuçlarını dönüştürmez.
- `contracts/surface-review.js`, kullanıcı çizimi ve OSM inceleme özelliklerinin sınıf, koordinat, halka-kesişme, GeoJSON halka kapanışı ve geometri boyut sınırlarını doğrular. `domain/surface/review-geometry.js` planar alan, bbox ve bbox çakışmasını saf fonksiyonlarda tutar. `application/surface/prepare-review.js` worker sonucu ile 128 hücrelik fallback akışını; `application/surface/merge-review-features.js` analiz geometrisini sınıf bazlı GeoJSON gösterim özelliklerine dönüştürmeyi düzenler. `adapters/surface/review-store.js` Supabase yükleme/kaydetme ve revision compare-and-set davranışını; `adapters/surface/osm-review-objects.js` ham OSM etiket/geometrilerinden inceleme nesnesi üretimini; `adapters/surface/review-worker.js` worker yaşam döngüsü ve iptal/zaman aşımını uygular. `lc-review.js` mevcut `DG_SURFACE_REVIEW` API'sini koruyan composition/facade katmanıdır.
- `domain/parks/identity.js`, Türkçe park adı normalizasyonu, OSM/elle park anahtarı, proje etiketi, eşleştirme yarıçapı ve halka merkezini saf kurallarda tutar; alanı insan dilinde biçimlendirme serviste kalır. `park-registry.js` eski `dg*` çağrılarını uyumluluk sarmalayıcılarıyla korur.
- `domain/parks/is-schema-error.js`, yalnızca PostgreSQL/PostgREST tablo, kolon, fonksiyon ve şema önbelleği eksikliklerini tanır; yetki, ağ ve zaman aşımı hatalarını şema eksikliği saymaz. `dgIsSchemaError()` eski global API’sini korur.
- `application/parks/register-park.js`, parkı oturum cache'inden çözme, OSM anahtarı/ad-konum eşleşmesi, yeni kayıt satırını kurma, yer adını gerektiğinde çözme ve 23505 yarışını yeniden okuma sırasını yönetir. `adapters/parks/park-store.js` Supabase seçme ve ekleme sorgularını uygular; `park-registry.js` eski global API'yi ve bildirimleri bağlar.
- `application/parks/create-project.js`, kullanıcı, kayıtlı park ve etiketi doğrulayıp park bağlı proje kaydını oluşturur; geometri yazımını bağımlılık olarak çağırır. `adapters/parks/project-store.js` Supabase insert'ini taşır; `dgScanCreateProject()` eski toast, yönlendirme ve global API davranışını korur.
- `application/parks/link-project.js`, yönetici yetkisini, seçili parkı ve projeyi doğrular; eski proje etiketini korur, park bağını günceller ve ölçümlerin eksik `park_id` alanlarını best-effort tamamlar. `adapters/parks/project-link-store.js` iki Supabase yazımını taşır; `dgLinkProject()` eski bildirim ve yönlendirme API'sini korur.
- `application/parks/detect-park.js`, koordinat doğrulama, çevrimiçi kontrolü, OSM sorgu sırası, eski yanıt iptali, elle park fallback'i ve sessiz arama davranışını yönetir; `dgDetectAt()` toast, state, manual form ve çizim callback'lerini bağlar.
- `application/parks/create-manual-park.js`, elle park formu girdisini doğrular, hektarı m²'ye çevirir ve park kimliği use-case'ini çağırır; `dgCreateManualPark()` eski toast, seçili park state'i ve ekran yenilemesini sürdürür.
- `application/parks/search-park-by-name.js`, önce kayıtlı park adını arar, sonuç yoksa Nominatim geocoding'e geçer; `adapters/parks/park-search.js` Supabase ve Nominatim erişimini sağlar, `dgScanSearchByName()` ekran state'ini ve algılama akışını bağlar.
- `application/visitors/build-live-roster.js`, geçici Realtime presence girdilerinden oturumları tekilleştirir, yaşa göre sıralar ve arama/ekran/konum filtrelerini uygular; `visit-stats.js` eski `dgVis*` API'sini ve DOM/harita akışını korur. Modül veritabanına erişmez ve presence verisini kalıcılaştırmaz.
- `application/visitors/build-live-activity.js`, geçici oturum, gezinme ve kullanıcı eylemi alanlarından çevrilebilir, en yeni olayları önceleyen canlı etkinlik listesini üretir; `dgVisFeed()` yalnız mevcut DOM biçimlendirmesini ve HTML çizimini yapar.
- `application/parks/find-park-candidates.js`, Overpass sorgusu, Nominatim sınır yedeği, geometri doğrulama ve kullanıcı konumuna göre en küçük park adayını seçme sırasını yürütür; `park-query.js` eski `queryPark()` API'sini ve geometri callback'lerini bağlar.
- `application/parks/classify-coverage-elements.js`, detaylı OSM kapsamındaki su, yaya engeli ve sert yüzey öğelerini önceki sıra ve tekilleştirme kurallarıyla yönlendirir; geometri üretimi ve `park-query.js` durum yazımı adapter'da kalır.
- `domain/parks/road-half-width.js`, `highway` sınıfına göre grid çakışma tamponunun varsayılan yarı-genişliğini üretir; açık OSM `width`/`lanes` değerlerinin önceliği ve tüm geometriler `park-geometry.js` içinde kalır.
- `domain/parks/classify-surface-tags.js`, eski `isWater()` ve `isImpervious()` OSM etiket kararlarını saf API'de tutar; `park-geometry.js` bu kuralları global uyumluluk sarmalayıcılarıyla sunar.
- `domain/parks/area.js`, mevcut jeodezik halka alan formülünü ve dış halka eksi iç halkalar toplamını `[LON,LAT]` sözleşmesiyle korur; `park-geometry.js` eski `ringGeodesicArea()`/`polyArea()` adlarını sarmalar.
- `domain/parks/segment-intersection.js`, düzlemde yönelim, nokta-doğru parçası ve doğru parçası kesişim kararlarını eski `1e-9` toleransıyla korur; `park-geometry.js` global yardımcı adlarını sarmalar.
- `domain/parks/point-in-polygon.js`, metre tabanlı yerel izdüşümü ve `[LAT,LON]` halkaları kullanan ışın-kesişim nokta testini taşır; `park-geometry.js` eski global adlarını sarmalar.
- `domain/parks/bounds.js`, izdüşürülmüş halka sınırlarını, genişletme/çakışma kararlarını ve dikdörtgen köşe sırasını üretir; izdüşüm kuralını nokta-poligon domain API'sinden alır.
- `domain/parks/park-containment.js`, dış park halkası ile iç delikleri noktanın `[LAT,LON]` sözleşmesine göre değerlendirir; `park-geometry.js` eski global `pointInPark()` adını korur ve legacy delikleri açıkça aktarır.
- `domain/parks/line-distance.js`, nokta-segment mesafesini ve sert yüzey/yol çizgisine yakınlık kurallarını mevcut metre hesabı, varsayılan genişlik ve kapsayıcı eşiklerle sunar; servis eski fonksiyon adlarını korur.
- `domain/parks/osm-rings.js`, OSM way/relation koordinatlarını filtreleyip mevcut kapanış ve `1e-6` uç eşleştirme kurallarıyla dış/iç halkaları kurar; `park-geometry.js` eski yardımcı adlarını sarmalar.
- `domain/parks/rect-intersection.js`, projeksiyonlu segment, halka ve çizgilerin dikdörtgenle kesişimini; bbox erken elemesi ve mevcut genişletme davranışıyla hesaplar.
- `domain/parks/simplify-ring.js`, park sınır halkasını deterministik nokta sınırına indirir; `application/parks/persist-park-geometry.js` dış/ iç halkaları hazırlar, `adapters/parks/park-geometry-store.js` Supabase `geom_json` yazımını yapar. `geofence.js` eski sadeleştirme ve kalıcılık fonksiyonlarını uyumluluk sarmalayıcısı olarak korur; yazım başarısızlığında daire yedeği davranışı sürer.
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
