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

- `config/i18n-en.js`, Türkçe anahtarlarla İngilizce karşılıkların sabit sözlüğünü taşır; `config/i18n.js` yalnızca ters sözlük, DOM çevirisi, kalıcılık ve dil değişimi davranışını yönetir. Sözlük, çalışma zamanı çeviricisinden önce yüklenir.

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
- `scripts/lib/report-map-clipping.mjs`, tarama çizgilerinde dış halka ve deliklerin dışındaki pikselleri bağlam rengine döndürür; sınıf bantlarının park sınırını aşmasını engelleyen mevcut piksel kuralını korur.
- `scripts/lib/report-map-scale-orientation.mjs`, metre ölçek seçimini, dönüşümlü ölçek çubuğunu ve kuzey okunu sabit piksel kurallarıyla çizer; `report-map.mjs` mevcut kartografik yerleşimi korur.
- `scripts/lib/report-map-legend.mjs`, rapor PNG'sindeki sınır, nokta, bağlam, maskeli alan ve sınıf lejantı satırlarını mevcut sırayla çizer; `report-map.mjs` sınıf/alan sunum kararlarını bağlar.
- `scripts/lib/report-map-footer.mjs`, harita altbilgisindeki belge kimliği, marka, veri kaynağı, çözünürlük, projeksiyon ve analiz künyesini çizer; dar tuvalde metin punto düşürme ve eksik metadata yedeğini korur.
- `scripts/lib/report-map-class-presentation.mjs`, PNG sınıf etiketlerini ve lejant satırlarının sabit sırasını çözer; `pool` yalnız harita sunumunda `water` sınıfına katılır, rapor snapshot'ı değişmez.
- `scripts/lib/report-map-projection.mjs`, kabul edilmiş dış halkalardan yerel equirectangular X/Y dönüşümünü, ölçeği ve harita tuvali genişliğini hesaplar; `report-map.mjs` aynı piksel dönüşümünü kullanır.
- `scripts/lib/report-map-primitives.mjs`, rapor PNG'sinde halka doldurma, halo çizme ve dairesel nokta rasterizasyonunu sabit piksel kurallarıyla yapar; `report-map.mjs` katman sırasını ve çizim çağrılarını korur.
- `scripts/lib/report-map-surface-fill.mjs`, yüzey poligonlarının dış halkasını ve deliklerini PNG piksellerine even-odd kuralıyla rasterize eder; `report-map.mjs` aynı çizim sırasını ve piksel sonucunu koruyarak bu bağımsız yardımcıyı kullanır.
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
- `ui/park-admin-renderer.js`, hazırlanmış park sayaçları, boş/çift/adsız gruplar ve işlem callbacks ile yönetim tablosu HTML’ini üretir; `park-registry.js` sorgu bağlamını ve admin işlemlerini tutar.
- `application/parks/build-park-admin-overview.js`, park yönetim listesindeki proje/kayıt sayaçlarını, boş park filtresini, aynı adlı kimlik gruplarını ve adsız kayıtları mevcut sıralarıyla hazırlar; servis HTML sunumunu oluşturur.
- `application/parks/load-admin-park-identities.js`, yönetici erişimini doğrular, yükleniyor callback'inden sonra park/proje/ölçüm sorgularını paralel başlatır ve park sorgusu hatasını görünümden bağımsız bir sonuç olarak döndürür; `park-registry.js` Supabase sorgularını ve mevcut ekran geri bildirimini bağlar.
- `application/parks/rename-park-identity.js`, park adını ve kanonik ad anahtarını güncelleyip bağlı proje adlarını eşitleme akışını yürütür; `park-registry.js` Supabase, istem ve bildirim bağlayıcılarını korur.
- `application/parks/merge-park-identities.js` ve `delete-park-identity.js`, park kimliği birleştirme/silme adımlarını açık portlarla sıralar; başarısız veya iptal edilen işlemde oturum temizlenmez. `park-registry.js` veri erişimini, uyarı metinlerini ve eski global API'leri sağlar.
- `application/parks/plan-park-backfill.js`, yönetici ve bağlantı kapılarından sonra park bağı olmayan projeleri ölçüm merkezleriyle OSM'de arar, sorgular arasında nezaket aralığı bırakır ve sonuçları önizleme planına dönüştürür; `park-registry.js` veri, arama ve ilerleme portlarını bağlar.
- `application/parks/apply-park-backfill.js`, onaylanan eşleşmiş satırları sırayla kaydeder ve projelere bağlar; kayıt/bağlama hatalarında sonraki satıra geçip kısmi başarı sayılarını döndürür. `park-registry.js` onay metnini, veri bağlarını ve bildirimleri sağlar.
- `application/parks/create-backfill-park.js`, seçilen projenin ölçüm merkezi ve adını doğrulayıp yönetici onayıyla elle park kimliği oluşturur ve projeyi bağlar; `park-registry.js` servis çağrılarını ve başarılı bağ sonrası plan/ekran güncellemesini sağlar.
- `application/parks/backfill-park-geometry.js`, yönetici yetkisini, parkı bulma, OSM sınırını çekme, alanı güncelleme ve tamamlanma bildirim sırasını yönetir; `adapters/parks/fetch-osm-park-ring.js` OSM way/relation halkalarını çözer, `park-registry.js` Supabase ve mevcut toast/yenileme davranışlarını bağlar.
- `application/parks/evaluate-measurement-park-gate.js`, şema yedeği, kayıt düzenleme, proje seçimi, park bağı ve tek seferlik yönlendirme kararlarını verir; `park-registry.js` mevcut uyarı kartını ve ölçüm düğmesi durumunu sunar. `ui/park-measurement-gate.js`, kapı sonucuna göre mevcut uyarı HTML’ini ve kaydet düğmesi durumunu üretir; servis yönlendirmeyi uygular.
- `ui/park-project-options.js`, park/proje seçicilerindeki proje işaretlerini, park kapsamını, geriye uyumlu tüm-projeler yedeğini ve boş liste mesajını üretir; `park-registry.js` eski global fonksiyonları ve HTML kaçış bağımlılığını korur.
- `ui/park-admin-status.js`, park geri doldurma ve park yönetimi kutularının çevrimdışı, hata, boş ve yükleniyor HTML durumlarını üretir; `park-registry.js` yetki, sorgu sonucu, toast ve DOM seçimini yönetir.
- `ui/park-schema-warning.js`, park şeması kullanılamadığında mevcut uyarı HTML’ini üretir; şema yeteneği ve eski proje bazlı yedek kararı `park-registry.js` içinde kalır.
- `application/parks/detect-backfill-park.js`, eski projelerin park aramasını 1500 m → 3500 m → ad sırasıyla yürütür ve iki Overpass sorgusu arasında 2,1 saniye bekler; `adapters/parks/search-osm-park-by-name.js` ada göre OSM sorgusunu ve aday alan sıralamasını yapar. `park-registry.js` sorgu, geometri ve uyumluluk bağlarını korur.
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
- `application/parks/build-grid-waypoint-rows.js`, grid hücrelerinin güvenli iç koordinatlarını altı ondalık basamakla, legacy hücre merkezini yedek alarak sıralı waypoint kayıtlarına dönüştürür; `grid-engine.js` mevcut kullanıcı ve proje kimliklerini geçirir.
- `application/parks/count-grid-cell-measurements.js`, onaylı ölçümleri grid indeksine göre aday hücrelere eşler ve projeksiyonlu gerçek geometri testiyle ölçüm sayısını artırır; koordinat projeksiyonu ve geometri bağımlılıklarını grid servisi sağlar.
- `application/parks/build-grid-request.js`, çözülmüş yüzey parçaları ve legacy su/sert zemin engellerini mevcut worker request DTO'suna dönüştürür; parça varsa eski halka engellerini, yoksa fallback halka ve çizgi listelerini taşır.
- `application/parks/is-grid-waypoint-context-current.js`, async waypoint sorgusundan sonra yüzey imzası, grid kaynağı, park nesnesi ve proje kimliğini sırayla yeniden denetler; ilk uyuşmazlıkta sonraki durum okumalarını yapmaz.
- `application/parks/resolve-grid-waypoint-readiness.js`, grid varlığı, yüzey imzası, proje ve hücre seçimi kontrollerini mevcut sırayla değerlendirir; servis aynı uyarıları gösterip uygun hedef hücreleri alır.
- `application/parks/select-grid-waypoint-cells.js`, otomatik modda ölçümsüz hücreleri, elle modda yalnız seçili hücreleri özgün sırayla döndürür; `grid-engine.js` eski uyarı ve kayıt akışını korur.
- `adapters/parks/fetch-latest-grid-waypoint.js`, proje kapsamındaki en yüksek waypoint kimliğini Supabase'ten azalan sıralama ve tek satır sınırıyla okur; `grid-engine.js` mevcut kimlik devamını aynı sorgu sonucu üzerinden sürdürür.
- `adapters/parks/insert-grid-waypoints.js`, hazırlanmış waypoint satırlarını `waypoints` tablosuna yazar ve Supabase sonucunu aynen döndürür; servis mevcut hata toast'ını ve harita çizimini sürdürür.
- `application/parks/prepare-grid-waypoint-batch.js`, son proje waypoint kimliğinden başlayarak seçili grid hücreleri için satır üretimini mevcut satır kurucusuna devreder; `grid-engine.js` son kimlik aralığını aynı batch'ten hesaplar.
- `adapters/parks/fetch-grid-measurement-candidates.js`, park bbox'ı içinde onaylı ölçümlerin koordinatlarını ve toplam sayısını 5.000 satır sınırıyla getirir; hücre eşleme ve projeksiyon uygulama katmanında kalır.
- `domain/parks/grid-options.js`, grid hücre boyutu ve 1–20 m clearance varsayılan/sınır kurallarını mevcut sayısal davranışla çözer; DOM girdilerini servis okur.
- `domain/parks/grid-cell-shape.js`, GeoJSON hücre halkalarını `[LON,LAT]` düzeninden Leaflet `[LAT,LON]` düzenine çevirir; geometri taşımayan eski hücreler mevcut dört köşe yedeğini kullanır.
- `domain/parks/grid-bounds.js`, dış halka ve delik koordinatlarından grid sorgusunun enlem/boylam sınırlarını üretir; `grid-engine.js` bbox'ı ölçüm adapter'ına aktarır.
- `application/parks/prepare-grid-surface-parts.js`, kayıtlı inceleme geometrisine öncelik verir, yoksa en son yüzey analizini mevcut hazırlama servisine gönderir; hiçbiri yoksa boş parça listesi döndürür.
- `ui/grid-waypoint-layer.js`, yeni waypoint marker katmanını oluşturur, önceki katmanı kaldırır ve her kayıt için sabit görünümde daire işaretçisi çizer; servis dönen katman referansını saklar.
- `ui/grid-summary.js`, grid hücre sayıları ve seçim sayısından mevcut HTML özetini üretir; `grid-engine.js` yalnız DOM öğesini, sayaçları ve çeviri yardımcılarını geçirir.
- `application/parks/resolve-grid-cell-style.js`, boş, ölçülmüş ve seçili grid hücrelerinin Leaflet stilini tek kuralla üretir; çizim ve seçim akışları aynı stili kullanır.
- `application/parks/count-grid-cell-states.js`, `n === 0` kuralıyla boş ve ölçülmüş grid hücrelerini sayar; çizim, seçim ve temizleme aynı sayım sonucunu kullanır.
- `application/parks/grid-review-signature.js`, grid sonucunu geçersiz kılan inceleme epoch, partition, tarama, düzenleme ve yüzey verisi alanlarını sıralı imzaya çevirir; servis güncel imzayla eski sonuçları karşılaştırır.
- `domain/parks/road-half-width.js`, `highway` sınıfına göre grid çakışma tamponunun varsayılan yarı-genişliğini üretir; açık OSM `width`/`lanes` değerlerinin önceliği ve tüm geometriler `park-geometry.js` içinde kalır.
- `domain/parks/classify-surface-tags.js`, eski `isWater()` ve `isImpervious()` OSM etiket kararlarını saf API'de tutar; `park-geometry.js` bu kuralları global uyumluluk sarmalayıcılarıyla sunar.
- `domain/parks/area.js`, mevcut jeodezik halka alan formülünü ve dış halka eksi iç halkalar toplamını `[LON,LAT]` sözleşmesiyle korur; `park-geometry.js` eski `ringGeodesicArea()`/`polyArea()` adlarını sarmalar.
- `domain/parks/resolve-park-area.js`, önce pozitif ve sonlu seçili alanı, yoksa dış/iç halka geometri alanını kullanır ve mevcut 10.000 m²/ha dönüşümünü uygular; `park-geometry.js` global park durumunu domain'e aktarır.
- `domain/parks/segment-intersection.js`, düzlemde yönelim, nokta-doğru parçası ve doğru parçası kesişim kararlarını eski `1e-9` toleransıyla korur; `park-geometry.js` global yardımcı adlarını sarmalar.
- `domain/parks/point-in-polygon.js`, metre tabanlı yerel izdüşümü ve `[LAT,LON]` halkaları kullanan ışın-kesişim nokta testini taşır; `park-geometry.js` eski global adlarını sarmalar.
- `domain/parks/bounds.js`, izdüşürülmüş halka sınırlarını, genişletme/çakışma kararlarını ve dikdörtgen köşe sırasını üretir; izdüşüm kuralını nokta-poligon domain API'sinden alır.
- `domain/parks/park-containment.js`, dış park halkası ile iç delikleri noktanın `[LAT,LON]` sözleşmesine göre değerlendirir; `park-geometry.js` eski global `pointInPark()` adını korur ve legacy delikleri açıkça aktarır.
- `domain/parks/line-distance.js`, nokta-segment mesafesini ve sert yüzey/yol çizgisine yakınlık kurallarını mevcut metre hesabı, varsayılan genişlik ve kapsayıcı eşiklerle sunar; servis eski fonksiyon adlarını korur.
- `domain/parks/osm-rings.js`, OSM way/relation koordinatlarını filtreleyip mevcut kapanış ve `1e-6` uç eşleştirme kurallarıyla dış/iç halkaları kurar; `park-geometry.js` eski yardımcı adlarını sarmalar.
- `domain/parks/rect-intersection.js`, projeksiyonlu segment, halka ve çizgilerin dikdörtgenle kesişimini; bbox erken elemesi ve mevcut genişletme davranışıyla hesaplar.
- `domain/parks/cell-in-park.js`, merkez/köşe doğrulaması, park sınırı kesişimi ve iç delik denetimiyle örnekleme hücresinin parkta kalmasını güvenli biçimde belirler; park geometrisi servisi seçili halkaları aktarır.
- `domain/parks/park-overlap.js`, aday halka/çizgiyi park sınırına karşı bbox, nokta-içeride, 5 m çizgi örnekleme ve segment kesişimiyle değerlendirir; `park-geometry.js` legacy `ringTouchesPark()`/`lineTouchesPark()` API'lerini korur.
- `domain/parks/impervious-geometry.js`, OSM sert zemin alanı, yol çizgisi ve yaya yolu grid engelleyicisi kurallarını uygular; `park-geometry.js` eski toplama fonksiyonlarını mevcut global dizilere bağlayan sarmalayıcılar olarak korur.
- `domain/parks/cell-validity.js`, park sınırı, isteğe bağlı yeşil alan ve su/sert zemin engelleri karşısında grid hücresinin geçerliliğini bağımlılıklarla verilen saf kurallarda değerlendirir; `park-geometry.js` legacy `isCellValid()` API'sini global durum adaptörü olarak korur.
- `domain/parks/simplify-ring.js`, park sınır halkasını deterministik nokta sınırına indirir; `application/parks/persist-park-geometry.js` dış/ iç halkaları hazırlar, `adapters/parks/park-geometry-store.js` Supabase `geom_json` yazımını yapar. `geofence.js` eski sadeleştirme ve kalıcılık fonksiyonlarını uyumluluk sarmalayıcısı olarak korur; yazım başarısızlığında daire yedeği davranışı sürer.
- Yeni dosyalar analiz zincirine sürümlü lazy loader ve service worker precache üzerinden eklenmiştir.

Bu ayrım raster sınıflandırma kodlarını, kaynak eşlemesini, eşikleri, Sentinel/OSM inceleme davranışını veya alan hesabı formüllerini değiştirmez. Kabul edilen rapor ve Supabase şeması değişmemiştir.

- `application/parks/merge-park-identities.js`, park birleştirmede projeleri ve ölçümleri taşıma, proje adlarını eşitleme, kaynak kimliği silme sırasını açık portlarla yönetir; `park-registry.js` Supabase/UI adapterlarını ve eski global çağrıyı korur.

- `application/parks/rename-park-identity.js`, park adını ve kanonik ad anahtarını güncelleyip bağlı proje adlarını eşitleme akışını yürütür; `park-registry.js` Supabase, istem ve bildirim bağlayıcılarını korur.

- `application/parks/delete-park-identity.js`, park kimliği silme yetkisini, uyarı onayını ve başarılı silme sonrası oturum temizliğini yönetir; DB işlemi ve bildirimler serviste kalır.

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

- `ui/park-backfill-progress.js`, eski projelerin park eşleştirme ilerlemesini verilen kutu, proje adı ve sayaçlarla çizer; `park-registry.js` DOM seçimi ve HTML kaçış işlevini bağlar. Arama sırası, bekleme süreleri ve kayıt işlemleri korunur.

- `ui/park-backfill-plan.js`, eşleşmiş, park bulunamayan ve ölçümsüz proje satırlarının önizlemesini üretir; planı değiştirmez ve veri yazmaz. Servis DOM, HTML kaçışı, hektar biçimi ve çeviri bağlarını sağlar.

- `ui/park-identity.js`, park kimlik çipini ve elle park formunu verilen durumdan üretir; `park-registry.js` taslak → harita anchor → GPS konum önceliğini ve HTML kaçışını bağlar. Form kimlikleri, alan biçimleri, düğmeler ve mevcut global çağrılar korunur.

- `ui/park-scan-card.js`, park bulma, kimlik doğrulama ve proje oluşturma kartını verilen görünüm durumundan çizer. Servis kaydırma korumasını, yüzey inceleme sırasında kartın gizlenmesini ve durum/işlev bağlarını sürdürür. Yöneticiye bağlı proje seçenekleri ve mevcut düğme çağrıları korunur.

- `ui/grid-selection.js`, hücre seçimini açma/kapatma ve temizleme sırasında seçili kimlikleri, hücre stillerini ve özet yenilemesini koordine eder. `grid-engine.js` güncel grid/katman durumunu ve mevcut stil/sayaç işlevlerini bağlar; eski `toggleCellSelection` ve `clearCellSelection` çağrıları korunur.

- `ui/map-layer-visibility.js`, var olan Leaflet katmanının görünürlüğünü haritanın gerçek katman durumuna göre değiştirir ve ilgili kontrolü eşitler. `grid-engine.js` grid/otomatik waypoint katmanlarını ve mevcut `togGrid`/`togWp` kontrollerini geçirir; katman yoksa işlem yapılmaz.

- `ui/grid-reset.js`, mevcut grid renderer/katmanlarını kaldırır, hücre ve seçim kaplarını yerinde temizler, özeti gizler ve görünürlük kontrollerini sıfırlar. `clearGrid()` metadata/kaynak temizliğini ve epoch artırarak devam eden üretimi geçersiz kılmayı sürdürür; katman referansları callback ile aynı sırada güncellenir.

- `ui/grid-layer.js`, grid katmanını ve canvas renderer oluşturur; mevcut hücre şekil/stil işlevleri, seçim callback ve tooltip çevirisini kullanır. Servis katman referanslarını ve özet bağını sağlar; `_cellId`, tıklama yayılımının durdurulması ve sticky tooltip davranışı korunur.

- `application/parks/create-grid-waypoints.js`, büyük waypoint partisi onayı, son kimliği okuma, asenkron bağlamı yeniden doğrulama, parti hazırlama ve kayıt sırasını yönetir. Servis önkoşul mesajlarını, son satır durumunu, katman çizimini, proje alanını ve tamamlanma bildirimini korur.

- `ui/grid-waypoint-completion.js`, başarılı waypoint kaydı ardından katmanı çizer, proje kontrolünü eşitler, listeyi yeniler, kimlik aralığı bildirimini gösterir ve hücre seçimini temizler. Servis başarı durumunu doğrular ve mevcut çizim/DOM/bildirim callback bağlarını sağlar.

- `application/parks/build-grid.js`, yüzey hazırlama, worker/yedek grid üretimi, ölçüm sorgusu/sayımı ve park/epoch/yüzey imzası doğrulama sırasını yürütür. Servis işlem kilidini, buton durumunu, kabul edilen hücreleri haritaya aktarmayı ve bildirimleri sağlar; mevcut hesap işlevleri değişmez.

- `ui/grid-build-controller.js`, tek grid üretimi kilidini ve buton yaşam döngüsünü yönetir; park yokluğu, eski sonuç, hata ve tamamlanma yollarında mevcut bildirimleri/temizliği sürdürür. Servis epoch ve kabul edilen grid durumunu günceller; eski `buildGrid()` girişini korur.

- `ui/grid-build-completion.js`, kabul edilen gridin temizleme, kaynak/özet güncelleme, hücreleri aktarma, çizim ve bildirim sırasını yönetir. Servis mevcut durum kaplarını ve callback bağlarını sağlar; alan biçimi ve önizleme/kayıtlı yüzey etiketi korunur.

- `ui/grid-waypoint-controller.js`, önkoşul ve üretim sonuçlarını mevcut mesajlarla yönlendirir; iptal, eski yüzey ve yazım hatasında tamamlanma ekranını çalıştırmaz. Servis güncel bağlamı ve mevcut üretim/tamamlama portlarını sağlar.

- `application/parks/grid-session-state.js`, grid epoch, renderer, kabul edilen yüzey imzası ve özet metadata durumuna sahiptir. Her oturum ayrı closure kullanır; invalidation kaynak/özet temizler ve epoch artırır. Paylaşılan hücre/seçim kapları ve katman uyumluluk bağları bu aşamada korunur.

- Grid oturumu `park-state.js` içinde bir kez kurulur ve hücre/seçim kaplarına da sahip olur. `GRID_CELLS`/`SELECTED_CELLS` dışa aktarma ve park ekranları için aynı kaplara bağlı uyumluluk adlarıdır; grid servisi açık oturum metotlarını kullanır. Oturum modülü park durumundan önce yüklenir.

- Grid ve otomatik waypoint katman referansları da grid oturumuna aittir; servis çizim, görünürlük ve temizleme callback’lerini oturum metotlarına bağlar. Eski mutable `GRID_LAYER`/`WP_AUTO_LAYER` global değişkenleri kaldırılmıştır. Harita yokken katman referanslarını koruyan mevcut temizleme davranışı sürer.

- Park ekranı, park/GIS dışa aktarımları ve yüzey önizleme çıktısı hücreleri grid oturumunun `getCells()` arayüzünden okur; eski `GRID_CELLS`/`SELECTED_CELLS` global aliasları kaldırılmıştır. Grid yüklenmemişken isteğe bağlı çıktı yollarının mevcut guard davranışı korunur.

- `ui/park-reference-area.js`, referans alan girişinin mevcut parseFloat/pozitif değer kuralını ve sapma rozetini yönetir. Park ekranı referans durumunu ve ölçülen alanı bağlar; referans yalnız karşılaştırmadır, geometri/hesaplanan alanı değiştirmez. %3 renk eşiği ve sayı biçimleri korunur.

- `ui/park-mode-controller.js`, park modu düğmesi/ipuçlarını, tıklama bağlama sırasını, kapatmada aday/park temizliğini ve harita hazır değilken kapalı duruma dönüşü yönetir. Park ekranı mevcut durum ve harita callback bağlarını sağlar; metin, blue sınıfı ve aria-pressed davranışı korunur.

- `ui/park-click-controller.js`, harita click dinleyicisini bir kez bağlar; her tıklamada güncel park modu ve yüzey inceleme korumasını kontrol eder. Algılama ve hata kayıt/bildirim portlarını park ekranı sağlar. Koordinat sırası, harita yokken yeniden bağlama fırsatı ve mevcut hata metni korunur.

- `ui/choose-new-park-controller.js`, yeni park seçimine dönüşte meşgul kapısını, varsa mevcut incelemeyi kaydetmeyi bekleme, park/grid/analiz temizliği ve harita yönlendirme sırasını yönetir. Park ekranı mevcut callback bağlarını sağlar; kayıt hatasında temizleme başlamaz.

- `ui/park-reset-controller.js`, menü temizliği, park/su/sert katman kaldırma, geometri/kimlik sıfırlama, inceleme cleanup ve yerel yüzey kaplarını sıfırlama sırasını yönetir. Harita yokken katman referansları korunur; yalnız cleanup hatası eski davranıştaki gibi yutulur. Park ekranı mevcut durum bağlarını sağlar.

- `ui/park-boundary-layer.js`, park dış/iç halkalarını mevcut Leaflet stilleriyle çizer ve verilen halkalarla harita sınırını kurar. Çizim geometriyi değiştirmez; katman referansı polygon çiziminden önce bağlanır. Park ekranı OSM kapsamı sonrası fit sırasını ve 30 px padding değerini korur.

- `ui/park-candidate-select.js`, alternatif park seçeneklerinin mevcut sırasını, aktif park kimliğini, HTML kaçışını ve bir ondalık hektar gösterimini üretir. Tek/boş aday listesinde seçici çizmez; park paneli `switchPark` çağrısını ve mevcut biçimleyicileri bağlar.
- `ui/visitor-activity-feed.js`, kurucuya gösterilen geçici canlı etkinlik listesini gelen olaylardan çizer. Veriyi üretmez veya saklamaz; yerel saat, mevcut çeviri ve HTML kaçışı çağıran servis tarafından verilir.
- `ui/visitor-database-activity.js`, kurucunun saklı etkinlik sorgularından gelen satırları mevcut çevrilmiş ve kaçış uygulanmış tablo görünümüne çizer. Sorgu, sıralama ve 60 satırlık sınır `visit-stats.js` içinde kalır.
- `application/visitors/build-stored-activity.js`, dört kurucu etkinlik sorgusundan ayrı ayrı gelen ölçüm, proje, veri isteği ve rapor isteği kayıtlarını mevcut çeviri ve ayrıntı metinleriyle en yeni sıradaki satırlara dönüştürür; erişim, sorgu limitleri ve tablo gösterimi çağıran katmanlarda kalır.
- `adapters/visitors/stored-activity-store.js`, kurucu etkinlik tablosunun dört mevcut Supabase sorgusunu sıralama ve kayıt limitleriyle ayrı ayrı yükler; her sorgunun hata yalıtımı ve sonuç listesi korunur, yetki kontrolü servis katmanında kalır.
- `adapters/visitors/live-visit-counts-store.js`, kurucu canlı ziyaretçi panelinin toplam, bugün ve kayan yedi günlük sayaçlarını mevcut `site_visits` count sorgularıyla okur; yerel gün başlangıcı, owner denetimi ve DOM güncellemesi servis katmanında kalır.
- `adapters/visitors/track-visit.js`, tekil anonim ziyaret kaydını `site_visits` tablosuna ham REST isteğiyle ve `Prefer: return=minimal` başlığıyla ekler; sekme başına tekilleştirme ve hataları sessiz yalıtma `trackVisit()` içinde kalır.

- `ui/park-info-panel.js`, park sonucundaki grid, yüzey, PNG ve katman kontrollerinin markup yapısını üretir. Park state, park kimliği, proje seçenekleri, alternatif seçici ve kaçış işlevi çağıran ekrandan verilir; mevcut DOM kimlikleri ve eylem callback’leri korunur.

- `ui/park-menu-ui.js`, park grid/katman kontrollerini mevcut DOM düğümlerini kopyalamadan menüye taşır; sahiplik temizliği, sıra, tek açık menü ve Escape/dış tıklamayla kapatma davranışlarını yönetir. `park-panel.js` mevcut `dgEditor*` çağrıları için uyumlu sarmalayıcıları tutar.

- `ui/park-image-geometry.js`, vektör PNG çıktısının enlem/boylam → piksel projeksiyonunu ve Canvas halka yolunu sağlar. Ölçek ve koordinat sırası mevcut `park-export.js` çağrılarında aynı kalır; çizim durumu dışarıda tutulur.

- `ui/gis-export.js`, doğrulanmış harita PNG'sinde park halkası projeksiyonunu `park-image-geometry.js` üzerinden kullanır; çok halkalı kırpma halkaları aynı Canvas yolunda biriktirilir. Vektör katmanları ve göreli NDVI akışı değişmez.

- `ui/gis-export-canvas.js`, GIS PNG çıktısındaki vektör katmanlarını, standart/GeoJSON grid hücrelerini, waypoint işaretlerini ve kaynak/NDVI legend'ını Canvas'a çizer. `gis-export.js` orkestrasyon, park kırpması, proje filtresi/tekilleştirme ve dışa aktarma akışını yönetir.
- `ui/gis-export-canvas-legend.js`, standart ve göreli NDVI export'larının legend/kaynak altbilgisini çizer. `DG_GIS_EXPORT_CANVAS.drawLegend` eski çağrılar için korunur; yeni script canvas API'sinden önce yüklenir.
- `ui/gis-export-canvas-waypoints.js`, standart ve doğrulanmış GIS PNG'lerinde ziyaret durumu ve waypoint numarasına göre mevcut işaretleri çizer. `DG_GIS_EXPORT_CANVAS.drawWaypoints` ve `drawVerifiedWaypoints` uyumluluk API'leri korunur.
- `ui/gis-export-canvas-grids.js`, standart sınır kutusu grid'lerini ve doğrulanmış GeoJSON/geriye uyumlu grid konturlarını çizer. `DG_GIS_EXPORT_CANVAS.drawGrid` ve `drawVerifiedGrid` API'leri korunur.
- `ui/gis-export-canvas-leaflet.js`, Leaflet katmanlarının iç/dış halkalarını tek even-odd Canvas dolgusuna aktarır; `DG_GIS_EXPORT_CANVAS.eachRing` ve `drawLeaflet` çağrıları korunur.
- `ui/gis-export-canvas-patches.js`, ham yüzey patch halkalarını mevcut sınıf renkleri ve even-odd kuralla Canvas'a çizer; `DG_GIS_EXPORT_CANVAS.drawRawPatches` API'si korunur.

- `ui/gis-export-vegetation.js`, göreli NDVI poligonlarının hazır olup olmadığını ve sınırlı bekleme davranışını yönetir. Eşik ve çizim işlevlerini çağıran aktarır; PNG export mevcut gözlemler hazır değilse durur.

- `ui/gis-export-events.js`, eski PNG düğmesi ile yüzey dışa aktarım diyaloğunun click yakalama ve katman seçimi uyumluluğunu sağlar; indirme işini GIS export adapter'ına bırakır.

- `ui/gis-export-download.js`, standart ve doğrulanmış GIS PNG'lerinde `Blob` üretimi sonrası bağlantı indirme, object-URL ömrü ve başarısız üretim bildirimi callback'lerini ortaklaştırır. Dosya adı ve başarı bildirimi her iki export akışında çağıranda kalır.

- `ui/gis-export-verified-canvas.js`, doğrulanmış harita PNG'sinin mevcut çizim sırasını ve yayın hatalarını koruyarak harita, özet ve çerçeve modüllerini çağırır. Analiz ve yayın kapıları ile PNG indirme `gis-export-verified-workflow.js` tarafından yönetilir.
- `ui/gis-export-verified-frame.js`, doğrulanmış GIS PNG'sinin sabit marka başlığı ve kaynak altbilgisini çizer; canvas bağdaştırıcısı bunları harita ve özet çiziminin mevcut sırasındaki noktalardan çağırır.
- `ui/gis-export-verified-summary.js`, doğrulanmış GIS PNG'sinin park alanı, düzenleme sayısı, yüzey alanları ve göreli NDVI sınıf özetini verilen değerlerden çizer; alan hesabı ve veri toplama bağdaştırıcıda kalır.
- `ui/gis-export-verified-layers.js`, doğrulanmış GIS PNG'sinin park kırpması içindeki yüzey, göreli NDVI, grid ve waypoint katmanlarını birleştirip sınırı çizer; çizim başarısızlık uyarılarını ve katman sırasını korur.
- `ui/gis-workspace-analysis-layout.js`, mevcut analiz kartlarındaki grup satırı ve en yaygın altı tür açılır sunumunu düzenler; var olan DOM düğümlerini ve sayısal analiz değerlerini korur.
- `ui/gis-workspace-menu-position.js`, açık GIS menülerinin panelini mobil ve masaüstü görünüm alanına göre yerleştirir; menü durumunu, harita etkileşimini ve içerikleri değiştirmez.
- `ui/gis-workspace-map-tools-view.js`, mevcut mesafe/alan, park odağı ve WGS84 koordinat kontrollerini mevcut harita menüsüne kurar; komutları, ölçümleri ve harita durumunu workspace sahibi yönetir.
- `application/visitors/record-live-session-events.js`, geçici presence için yinelenen sekme geçmişini, 60 karakterlik son eylemi ve 1e-5° eşiği/12 nokta sınırındaki konum izini bellekte tutar; ağ ve veritabanı çağrısı yapmaz.
- `ui/gis-export-standard-layers.js`, standart GIS PNG'sinde park kırpması içindeki örtü, NDVI, grid ve waypoint katmanlarını sırayla birleştirir; dış sınırı aynı kırpma sonrası adımda çizer.

- `ui/gis-export-layout.js`, standart ve onaylı GIS PNG için park bounds, metre ölçüsü, canvas boyutu ve piksel projeksiyonunu hesaplar. Geçersiz ya da sıfır alanlı sınırı reddeder; çizim ve indirme adapter'da kalır.

- `application/surface/prepare-verified-map-export.js`, doğrulanmış harita PNG'si için kayıt, park, NDVI görünümü ve en az dokuz uygun hücre kapılarını salt okunur biçimde değerlendirir. `gis-export.js` eski uyarıları ve indirme akışını korur; hassasiyet eşikleri ile analiz verisine yazmaz.

- `ui/park-export-layout.js`, park analiz PNG'si için dış sınır ve deliklerden metre tamponlu bounds, canvas boyutu ve projeksiyon girdilerini hesaplar; görsel çizimi `park-export.js` içinde bırakır.

- `domain/parks/park-export-formats.js`, grid GeoJSON özelliklerini/geometri yedeğini ve waypoint CSV satırlarını üretir; indirme ve kullanıcı bildirimi `park-export.js` içinde kalır.

- `ui/park-export-canvas.js`, park dışa aktarım PNG'sinin zemin, başlık, kırpılmış park/örtü/grid/waypoint katmanları, lejant, ölçek ve lisans satırını çizer; canvas indirme adapter tarafından yönetilir.

- `ui/park-landcover-analysis.js`, park LULC analizi için tembel modül yükleme, busy/rapor UI durumu, sonuç çizimi, hassasiyet paneli ve kullanıcı bildirimlerini orkestre eder. `park-export.js` eski `runLandCoverAnalysis()` globalini ve park state/DOM bağımlılıklarını adapter olarak korur; sayısal analiz `DG_LANDCOVER` içinde kalır.


## GIS PNG modülleri — 11 Ekim 2026

- `bootstrap/gis-export.js`, tarayıcı, veri ve sunum adaptörlerini iki PNG akışıyla bağlayan başlangıç katmanıdır. `ui/gis-export.js` yalnız mevcut global harita değerlerini kullanım anında okuyan uyumluluk bağlantılarını sağlar.
- `ui/gis-export-workflow.js`, standart PNG için park/NDVI kontrollerini, çizim hazırlığını ve indirmeyi yönetir. `ui/gis-export-verified-workflow.js`, doğrulanmış NDVI çıktısının yayın kapıları ve 1240×1560 çizim/indirme sırasını korur.
- `ui/gis-export-standard-canvas.js` ve `ui/gis-export-verified-canvas.js`, ilgili harita çıktısını verilen girdilerden çizer.
- `ui/gis-export-platform.js`, DOM seçenekleri, Canvas oluşturma ve bildirimleri sağlar. `ui/gis-export-sources.js`, grid, waypoint ve park metadata okuyucularının standart/doğrulanmış yedek davranışlarını korur.
- `ui/gis-export-presentation.js`, sınıf paleti, renk önceliği, Türkçe alan metni ve güvenli dosya adını sağlar. `ui/gis-export-bootstrap.js`, hata sarmalayıcılarını ve eski PNG düğmesi/global API bağlantısını kurar.
- Olay, geometri, yerleşim, NDVI bekleme ve indirme modülleri açık arayüzleriyle kullanılır. Bu ayrımda bilimsel çekirdek, kabul edilmiş alanlar ve harita kayıtlarına yazma davranışı değiştirilmez.

## Rapor kuyruk günlüğü — 11 Ekim 2026

- scripts/lib/report-queue-store.mjs günlük şemasını, kapasiteyi ve dosya okuma/yazmayı kapsar; publish-queue.mjs mevcut dışa aktarımları korur.
- Mutlak yollar node:path isAbsolute ile çözülür; Windows geçici dosyaları yanlışlıkla depo köküne eklenmez.
- Yayın ve yeniden deneme kararları değişmedi. Mevcut günlük ve üretim regresyonları dahil 1.844 test Windows üzerinde geçti.

## Rapor kuyruğu planlama — 11 Ekim 2026

- scripts/lib/report-queue-planning.mjs yayın sırasını, üç deneme sınırını ve geri çekme eşleşmelerini saf fonksiyonlarla yönetir. Dosya veya ağ erişimi yoktur.
- Rapor kimliği doğrulaması mevcut DGR_ID_RE üzerinden publish-queue.mjs tarafından sağlanır; mevcut dışa aktarımlar korunur.
- Yayımlanmış isteklerin tekrar üretimini ve park eşleşmesi olmadan geri çekmeyi engelleyen kurallar değişmedi.

## Kabul edilmiş yüzey rapor yayını — 11 Ekim 2026

- scripts/lib/accepted-surface-publication.mjs kabul edilmiş yüzey sonucunu aynı rapor kimliğine bağlayan akışı kapsar. Dosya, HTML, QR ve arşiv işlemleri dışarıdan sağlanır.
- publish-queue.mjs mevcut applyAcceptedSurfaceSnapshot dışa aktarımını ve varsayılan depo kökünü korur. Alan dönüşümü, içerik hash’i, üst veri ve geometri yayımlamama davranışı değişmedi.

## Tek rapor yayın isteği — 11 Ekim 2026

- scripts/lib/report-publication-request.mjs tek isteğin yayın sırasını, kabul edilmiş yüzey uygulamasını ve başarı/hata günlüğünü yönetir. Yayın, seçenek, arşiv boyutu ve saat bağımlılıkları dışarıdan sağlanır.
- publish-queue.mjs mevcut yayın seçeneklerini ve dosya boyutu adaptörünü bağlar. Bilinmeyen yüzey şeması üretimden önce reddedilir; boyut ölçüm hatası yayını engellemez.

## Rapor geri çekme akışı — 11 Ekim 2026

- scripts/lib/report-retraction-workflow.mjs geri çekme dosya listesini, kimlik kontrolünü, bildirim yazımını ve sonuç günlüğünü kapsar. Dosya, bildirim, arşiv ve saat bağımlılıkları dışarıdan sağlanır.
- publish-queue.mjs handleRetraction ve RETRACT_FILES dışa aktarımlarını ve varsayılan kökü korur. Mevcut dosya kaldırma, eksik dosya toleransı ve hata kayıtları değişmedi.

## Rapor kuyruk yürütücüsü — 11 Ekim 2026

- scripts/lib/report-queue-runner.mjs kuyruk okuma, planlama, sıralı yayın/geri çekme, prova modu ve her sonuçtan sonra günlük kaydetme akışını kapsar. Tüm dış işlemler bağımlılık olarak sağlanır.
- publish-queue.mjs CLI seçeneklerini ve mevcut runQueue dışa aktarımını korur; kuyruk okuma hatası, sayaçlar ve yayın sırası değişmedi.

## Rapor kuyruk bileşimi — 11 Ekim 2026

- scripts/lib/report-queue-application.mjs kabul edilmiş yüzey, yayın isteği, geri çekme ve kuyruk yürütücüsünü tek yerde bağlar. Oluşturulması yayın veya dosya işlemi başlatmaz.
- publish-queue.mjs ağ/CLI ve mevcut yayın seçeneklerini sağlayan uyumluluk girişidir; dışa aktarımlar ve varsayılan kök korunur.

## Rapor arşiv dosyaları — 11 Ekim 2026

- scripts/lib/report-artifact-writer.mjs HTML, PNG, yüzey geometrisi, veri, CSV, ölçüm geometrisi ve üst veri dosyalarının yazımını kapsar. Dosya ve rapor üretim bağımlılıkları dışarıdan sağlanır.
- publishPark kimlik atama, snapshot üretme, geçmiş ve liste yenileme sırasını korur. Dosya adları ve JSON biçimleri değişmedi.

## Park raporu yayın akışı — 11 Ekim 2026

- scripts/lib/park-report-publication.mjs künye doğrulama, kimlik/QR, snapshot, geçmiş, arşiv ve liste yenileme sırasını yönetir. Hesaplama, dosya ve sürüm bağımlılıkları dışarıdan sağlanır.
- make-report.mjs publishPark dışa aktarımını korur; kimlik snapshot öncesinde atanır, hesaplama ve yayın sonucu biçimi değişmedi.

## Rapor komut satırı — 11 Ekim 2026

- scripts/lib/report-cli.mjs liste yenileme, park/künye seçenekleri, yayın başlatma ve sonuç mesajlarını kapsar. Dosya, yayın, çıktı ve çıkış bağımlılıkları dışarıdan sağlanır.
- make-report.mjs main dışa aktarımını ve hata çıkış kodlarını korur; eksik park veya künye yayını başlatmaz.

## Rapor yayın bileşimi — 11 Ekim 2026

- scripts/lib/report-publication-application.mjs arşiv yazımı, park yayını ve komut satırı akışını birleştirir. Oluşturulması dış işlem başlatmaz.
- make-report.mjs publishPark/main girişlerini ve mevcut bağımlılıkları sağlar; kimlik, hesaplama ve dosya biçimleri korunur.

## Rapor çalışma sürümleri — 11 Ekim 2026

- scripts/lib/report-runtime-provenance.mjs motor/app sürümü ve üretim commit’ini bağımsız kaynak okuma işlemleriyle toplar. Kaynak yoksa veya bozuksa mevcut null davranışı korunur.
- make-report.mjs dosya ve Git adaptörlerini sağlar; bilimsel provenance sözleşmesi değişmedi.

## Rapor tür sunumu — 11 Ekim 2026

- scripts/lib/report-species-presentation.mjs tür grafiği, tablo satırları ve grup renk/etiketlerini kapsar. HTML kaçışı ve sayı biçimi mevcut adaptörlerden sağlanır.
- make-report.mjs bu sunumu mevcut rapor şablonuna bağlar; karbon hesaplama, tür sırası, renkler ve içerik korunur.

## Rapor QA sunumu — 11 Ekim 2026

- scripts/lib/report-qa-presentation.mjs QA satır sınıflarını ve satırlardan türetilen rozet sunumunu kapsar. Mevcut qaStateOf ve QA_STATE bağımlılıkları kullanılır.
- Kontrol eşikleri ve bilimsel değerlendirmeler make-report.mjs içinde kalır. Beyan satırları rozet durumunu etkilemez; her rapor ayrı satır durumu tutar.

## Rapor değerlendirme sunumu — 11 Ekim 2026

- scripts/lib/report-evaluation-presentation.mjs yüzey dağılımı, baskın sınıf ve grup karbon paylarını betimleyen mevcut paragrafları kapsar. HTML kaçışı ve sayı biçimi dışarıdan sağlanır.
- Ölçülmeyen alana ekstrapolasyon yapılmaması ve nedensel ilişki kurulmadığı beyanları korunur; kaynak sonuçlar değiştirilmez.

## Rapor sınırlılık sunumu — 11 Ekim 2026

- scripts/lib/report-limitations-presentation.mjs mevcut veri/model/GNSS/envanter sınırlılık cümlelerini kapsar. Eşikler ve yasal kapsam beyanı mevcut çekirdekten sağlanır.
- Gösterim koşulları, sıra ve metinler korunur; kaynak ölçümler ve hesaplama değişmez.

### Report citation presentation (11 October 2026)

`report-citation-presentation.mjs` owns plain citations, BibTeX and JSON-LD report identity. The report renderer supplies its validated DOI, version and frozen snapshot; author fallbacks, founder contributions, source citations and publication URLs retain their existing behavior.

### Report method presentation (11 October 2026)

`report-method-presentation.mjs` renders data-derived measurement, GNSS, photo and land-cover method statements. It preserves the existing accepted/reviewed/raster branches and receives formatters from the renderer; it performs no scientific calculation or publication side effect.

### Report QA explanations (11 October 2026)

`report-qa-explanation.mjs` assembles existing review reasons and the measurement-clean disclosure from snapshot QA findings. It preserves reason ordering, counts and the distinction between measurement findings and missing supporting evidence; classification and publication gates remain unchanged.

### Inventory QA detail presentation (11 October 2026)

`report-inventory-details.mjs` presents existing height/DBH, diameter distribution and carbon reproduction findings. Formatters and QA limits are injected; missing-value formatting, point-list truncation and review/block wording remain unchanged. Scientific QA decisions stay with the inventory engine.

### Report QA table composition (11 October 2026)

`report-qa-table.mjs` composes the existing QA table rows using an injected report-local row/state collector. Row order, optional surface and inventory checks, escaped source values and review/block conditions remain unchanged. The renderer summarizes the same collector after composing the table.

### Report history presentation (11 October 2026)

`report-history-presentation.mjs` renders supplied archive entries and appends the current report row without mutating history. Entry order, date/note fallbacks, escaping and current-report emphasis retain the existing behavior. Archive lookup and immutable publication storage remain separate.

### Report source descriptions (11 October 2026)

`report-sources-presentation.mjs` renders primary, supplementary, field and cross-validation source disclosures. It preserves accepted/reviewed/raster branches, used-scene filtering, escaped source values and scope statements, without loading data or changing analysis.

### Report document head (11 October 2026)

`report-document-head.mjs` renders document titles, descriptions, canonical/alternate links, sharing cards, JSON-LD and report styles through injected formatters. Existing image-card conditions and serialization remain unchanged; report calculations and publication behavior stay outside this module.

### Academic study presentation (11 October 2026)

`report-study-presentation.mjs` renders declared academic context, purpose, sampling and instruments. Existing field order, optional-field conditions, project width, independent-study disclosure and escaping remain unchanged. The frozen study snapshot and report title selection stay with their existing owners.

### Report cover presentation (11 October 2026)

`report-cover-presentation.mjs` renders report headings and the identity/provenance grid. Existing academic-title fallback, QA status hints, author fallback, optional versions and embedded QR/text-link branches remain unchanged; it consumes already-derived report values and performs no calculation or publication.

### Report overview presentation (11 October 2026)

`report-overview-presentation.mjs` renders analysis summary and site descriptions from existing report values. Sample-scope statements, density formatting, optional source disclosure, ignored-rectangle/self-intersection notes and geofence counts retain their behavior. Scientific totals and geometry checks remain outside the module.

### Report map presentation (11 October 2026)

`report-map-presentation.mjs` renders the existing map image and provenance caption. Missing-map, raster, reviewed geometry and visually generalized geometry branches retain their wording and conditions. Image generation, accepted geometry and numeric areas remain outside this module.

### Report map inventory points (12 October 2026)

`report-map-inventory-points.mjs` draws the existing halo and ink markers only when projected inventory coordinates fall inside the map frame. Frame edges remain inclusive; projection, map layout, input records and all other report layers remain with the renderer.

`report-map-surface-layers.mjs` draws the existing no-data base, cell and surface overlays, restores context outside the multi-ring park boundary, and draws the thin frame in the established order. Projection and the report map API remain in `report-map.mjs`.

`report-map-heading.mjs` draws the park title, optional subtitle lines and report ID in their existing positions and styles; `report-map.mjs` keeps the map layout and public API.

### Report provenance presentation (11 October 2026)

`report-provenance-presentation.mjs` renders reproducibility records and the analysis fingerprint from already-resolved provenance. Missing-version/commit/projection/DOI fallbacks, reviewed-archive versus raster instructions and escaping retain their behavior. Provenance collection and scientific analysis remain separate.

### Report references presentation (11 October 2026)

`report-references-presentation.mjs` renders the existing bibliography. Reference order, DOI text, reviewed/accepted Sentinel disclosure, optional escaped cross-validation source and site-derived methods link remain unchanged. Citation generation and scientific calculations stay separate.

### Report data access presentation (11 October 2026)

`report-data-access-presentation.mjs` renders artifact download links, print/share controls and reuse terms. Existing conditional map/PDF links, element identifiers, handlers, button classes and relative paths remain unchanged. Artifact production, PDF generation and sharing logic stay with their existing owners.

### Report quantitative results presentation (12 October 2026)

`report-results-presentation.mjs` renders precomputed species summaries, carbon intervals and surface/area-balance tables. Formatting, missing-value fallbacks, optional surface conditions and scientific scope statements remain unchanged. Monte Carlo and scientific area calculations stay outside this module.

### Report data dictionary (12 October 2026)

`report-data-dictionary.mjs` owns the static variable definitions, units and measurement note shown in §4.6. Text and markup are preserved verbatim, including raw girth versus derived DBH, biomass/carbon units and uncertainty scope. Scientific calculation and snapshot fields remain unchanged.
- `scripts/lib/report-document-composition.mjs`, `renderReport` için HTML belgesini ve bölüm sırasını birleştirir; bölüm sunumlarını enjekte edilen fonksiyonlardan alır. Veri erişimi, snapshot hesabı ve yayın I/O'su bu modüle taşınmaz.


### Report snapshot application (12 October 2026)

`scripts/lib/report-snapshot-application.mjs` assembles the existing immutable report snapshot from injected data, measurement, geometry, QA, provenance and map dependencies. The application owns the existing schema fallback, geofence and geometry disclosures, author selection, and hash boundary; `make-report.mjs` wires dependencies and preserves the `buildSnapshot` export. Scientific calculations and publication behavior are unchanged.


### Report park geometry source (12 October 2026)

`scripts/lib/report-park-geometry-source.mjs` resolves the park boundary used by report analysis. It prefers accepted non-bbox geometry, falls back to the OpenStreetMap way API or rotating Overpass relation mirrors, and retains outer/inner rings. Fetching, bbox detection and relation-ring parsing are injected; boundary choice and fallback behavior remain unchanged.


### Report land-cover analysis adapter (12 October 2026)

`scripts/lib/report-landcover-analysis.mjs` adapts the existing land-cover engine result for report snapshots and map imagery. It preserves boundary selection, analysis inputs, cell conversion, run-length coordinate conversion and EPSG recording. The analysis engine and scientific classification remain in the application runtime.


### Report land-cover runtime loader (12 October 2026)

`scripts/lib/report-landcover-runtime.mjs` creates the existing isolated browser-like runtime and loads the application's land-cover dependencies in order. `make-report.mjs` keeps the `bootLC` export and injects its existing repository reader. Runtime globals, dependency paths, module order and analysis behavior are preserved.


### Report REST adapter (12 October 2026)

`scripts/lib/report-rest-adapter.mjs` resolves the existing public Supabase URL and key, builds report REST requests, delegates reads to the existing `reportRead` policy, and preserves HTTP error messages and JSON responses. The report generator wires the adapter without changing query or authorization behavior.


### Report document client script (12 October 2026)

`scripts/lib/report-document-client-script.mjs` renders the browser script embedded in immutable report HTML. It preserves print-time icon stripping/restoration, canonical snapshot hash verification, and the existing share script insertion point. It does not change snapshot data or verification rules.

- `scripts/lib/report-method-section.mjs`, raporun §4 Yöntem HTML bölümünü mevcut yöntem beyanlarıyla oluşturur; veri türetimi `report-method-presentation.mjs` içinde, metodoloji metinleri ve formüller aynen korunur.

- `scripts/lib/report-verification-section.mjs`, raporun §7 QA ve içerik bütünlüğü beyanlarının mevcut HTML sunumunu üretir; QA kararları, Çizelge 4 satırları ve snapshot verileri uygulama katmanında kalır.

- `scripts/lib/report-document-backmatter.mjs`, raporun provenance, yayın geçmişi, atıf, kaynakça, veri erişimi ve footer sunumunu aynı sırada üretir; içerik ve üst veri girdileri mevcut rapor akışından gelir.

- `scripts/lib/report-document-quality-preparation.mjs`, immutable raporun QA tablosu girdilerini, mevcut alan özetlerini ve sunum durumunu hazırlar; kontrol politikası ve kararları enjekte edilen QA modüllerinde kalır, yeni yayın kapısı eklemez.

- `scripts/lib/report-document-context.mjs`, snapshot ve yayın metaverisinden rapor HTML'inin mevcut sunum bağlamını hazırlar; DOI, sürüm, alan ve kaynak açıklaması yedekleri ile escaped başlık davranışı korunur.

- `scripts/lib/report-discussion-sections.mjs`, raporun §8 Değerlendirme ve §9 Sınırlılıklar başlıklarını ve HTML kabuklarını mevcut sırada birleştirir; metin ve sınırlılık girdileri enjekte edilen sunum fonksiyonlarında kalır.

- `scripts/lib/report-document-opening.mjs`, rapor kapağı, çalışma bilgisi, analiz özeti, veri kaynakları ve mevcut kapsam beyanını aynı sırada birleştirir; içerik ve veri üretimi enjekte edilen sunumlarda kalır.

- `scripts/lib/report-findings-sections.mjs`, raporun §5 Nicel Sonuçlar ve §6 Harita HTML başlıklarını ve mevcut sunumları sırayla birleştirir; bilimsel sonuçlar ve harita sunumu enjekte edilen mevcut modüllerde kalır.

- `scripts/lib/report-html-escaping.mjs`, immutable rapor HTML'ine metin olarak eklenen değerleri mevcut `&`, `<`, `>`, `"` dönüşümleriyle kaçırır; `make-report.mjs` aynı `esc` yardımcı API'sini bu saf fonksiyona bağlar.

- `scripts/lib/report-formatting.mjs` artık Türkçe ondalık sayı biçimleyicisini de sağlar; `make-report.mjs` aynı `trNum` adını bu fonksiyona bağlar. Locale ve sabit ondalık basamak davranışı korunur.

- `scripts/lib/report-cli-arguments.mjs` `--name` biçimindeki rapor CLI bayraklarının varlık ve ilk değer okuma davranışını sağlar; `make-report.mjs` mevcut süreç argümanlarını bağlar, CLI akışı ve çıkış davranışı değişmez.

- `scripts/lib/report-site-origin.mjs` CNAME’den mevcut HTTPS yayın kökünü çözer ve boş/okunamayan değerlerde mevcut `https://dendrogeo.org` yedeğini korur; dosya okuma bağımlılığı rapor girişinde sağlanır.

- `scripts/lib/report-formatting.mjs`, rapordaki mevcut kilogramdan metrik tona gösterim dönüşümünü iki sabit ondalık basamakla biçimler; `make-report.mjs` aynı `fmtT` bağını kullanır, kaynak kg değerleri ve hesaplama akışı değişmez.

- `scripts/lib/report-repository-access.mjs` türetildiği giriş dosyasına göre aynı depo kökünü belirler ve raporun kullandığı göreli dosya yollarını UTF-8 okur; `make-report.mjs` kök ve okuyucu bağlarını aynı yolla alır.

- `scripts/lib/report-git-commit.mjs` rapor kökünde mevcut commit’i aynı sessiz `git rev-parse HEAD` komutuyla okur; boş/erişilemeyen provenance için mevcut null yedeği `report-runtime-provenance.mjs` içinde korunur.

- `scripts/lib/report-qr-loader.mjs` var olan `qrcode` build paketini çözer; paket bulunamazsa `null` döndürerek rapor üretiminin QR olmadan sürmesini sağlar, SVG üretimi `report-qr.mjs` içinde kalır.

- `adapters/visitors/admin-visit-counts-store.js`, yönetim ziyaret sayaçlarının tekil exact/head sorgularını taşır; sıralı yükleme, yerel gün ve kayan yedi gün hesabı, kısmi DOM güncellemeleri ve hata sınırı `loadVisitStats()` içinde korunur.

- `ui/visitor-roster.js`, geçici ziyaretçi listesinin bağlantı/filtre boş durumlarını ve kişi kartlarını mevcut çeviri, kaçış, rol, oturum ve konum gösterimiyle üretir; owner kapısı, filtreleme, akış ve harita güncellemesi servis katmanında kalır.

- `domain/visitors/device-label.js`, geçici presence cihaz etiketini kullanıcı aracısı girdisinden saf olarak üretir; mevcut tarayıcı/işletim sistemi eşleşme önceliği korunur, navigator erişimi ve hata yedeği servis katmanında kalır.

- `ui/visitor-map-marker.js`, ziyaretçi işaretinin baş harf ikonunu ve çevrilmiş/kaçış uygulanmış tooltip sunumunu üretir; Leaflet nesneleri, geçici izler, konum süzme ve harita takip durumu servis katmanında kalır.

- `adapters/visitors/session-id-store.js`, sekmeye ait `dg_sid` değerini yeniden kullanır veya mevcut rastgele üretim kuralıyla saklar; storage erişim hatasındaki `x` yedeği servis katmanında korunur.

- `ui/visitor-activity-disclosure.js`, Son Etkinlik sarmalının görünürlüğünü, çevrilmiş düğme etiketini ve `aria-expanded` durumunu birlikte günceller; tercih okuma/yazma ve eksik sarmal kontrolü servis katmanında kalır.

- `ui/visitor-connection-status.js`, bağlantı metnini, görünen/toplam kullanıcı sayısını, mevcut Türkçe saat biçimini ve durum rengini günceller; duraklatma metni aynı API içindedir, presence/filtre/görünürlük ve pause durumu serviste kalır.

- `domain/data-requests/find-pending-duplicate.js`, talep ülke/şehir/proje filtrelerini mevcut trim ve küçük harf kuralıyla karşılaştırır ve ilk eşleşmeyi döndürür; kullanıcı/status sorgusu, uyarı ve insert akışı serviste kalır.
