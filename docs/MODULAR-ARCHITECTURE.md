Warning: truncated output (original token count: 16065)
Total output lines: 487

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
- `application/parks/plan-park-backfill.js`, yönetici ve bağlantı kapılarından sonra park bağı olmayan projeleri ölçüm merkezleriyle OSM'de arar, sorgular arasında nezaket aralığı bırakır ve sonuçlar…8065 tokens truncated… geçmiş ve liste yenileme sırasını korur. Dosya adları ve JSON biçimleri değişmedi.

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
