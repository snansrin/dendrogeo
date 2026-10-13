# DendroGeo modüler mimari

## Mevcut sistem ve karar

Kod tabanı zaten alanlara göre ayrılmış `domain/`, `application/`, `adapters/` ve `ui/` katmanlarına sahip. Kaynakların büyük bölümü bundler kullanmayan klasik tarayıcı script'leri; `partials/head.html` yükleme sırasını, `index.html` üretilmiş sayfayı, `sw.js` ise çevrimdışı paket listesini belirliyor. Modüller çoğunlukla `window.DG_*` API'si yayımlıyor ve testler bu script'leri VM bağlamında yüklüyor. Bu çalışma modelinde önerilen `features/`, `ports/`, `platform/` ve `compatibility/` klasörleri henüz gerçek sınırlar değil.

Durum, Service Worker, güncelleme, lazy loading ve güvenlik önerilerinin kaynak kodla doğrulanmış ayrıntıları [`ARCHITECTURE-ASSESSMENT.md`](ARCHITECTURE-ASSESSMENT.md) içindedir. Yeni `store` veya PWA değişiklikleri bu kanıta ve [ADR 0006](adr/0006-state-and-pwa-migration.md) kararına göre yapılır.

Bu nedenle mevcut dosyaları topluca taşıma veya yeni bir paket/bundler katmanı ekleme yapılmaz. Yeni ve değiştirilen davranışlar mevcut katmanlarda alan klasörleri altında geliştirilir; script sırası, eski global API ve service-worker precache aynı değişikliğin parçası olarak güncellenir. `docs/adr/0005-incremental-layered-architecture.md` bu kararı ve geçiş ölçütlerini kaydeder.

## Katman sözleşmeleri

- `domain/{trees,parks,surface,reports,...}/`: deterministik iş/bilim/geometri kuralları. Tarayıcı API'si, Supabase, ağ, dosya sistemi, DOM veya başka katmanların global API'sini çağırmaz. Modül kendi `window.DG_*` adını dışa açabilir.
- `application/{alan}/`: bir use-case'in sırasını ve hata/iptal kararlarını yönetir. Bağımlılıkları `create({...})` ile callback/port olarak alır; doğrudan `sb`, Leaflet, global `fetch` veya UI modülü çağırmaz. Tarayıcıdaki bazı UI orkestrasyonları bugün burada yaşar; yeni form ve çizim davranışı için `ui/` seçilir.
- `adapters/{alan}/`: Supabase, REST/OSM/STAC, IndexedDB, dosya indirme ve tarayıcı dış kaynaklarıyla konuşur. Mevcut sorgu, RLS ve hata şekillerini taşır; domain kararını sahiplenmez.
- `ui/`: HTML üretimi, DOM etkileşimi, harita görünümü ve form durumu. İş kurallarını kopyalamaz; gerekli biçimleyici/işlev callback'lerini alır.
- `contracts/`: sınırdan geçen verinin çalışma anı şekil ve sürüm doğrulaması. `ports/` adında ayrı klasör henüz yok; callback nesneleri mevcut port sözleşmesidir. Sabit DTO sınırları çoğalıp ortak adlandırma gerektiğinde port dosyaları eklenir.
- `services/`: eski çağrı adlarını ve `window.DG_*` API'lerini koruyan facade/composition katmanı. Yeni iş kuralı burada büyütülmez; mevcut kilitli dosyalar yalnız açık modülerleştirme kapsamında değiştirilir.
- `bootstrap/`: global başlatma ve birden fazla katmanı bir araya getiren composition root. `core/` ve `utils/` yalnız mevcut uyumluluk/ortak yardımcılar için kullanılır; yeni iş alanı oraya konmaz.
- `workers/`: uzun süren raster, geometri ve grid işi. Worker mesajları doğrulanabilir DTO'lardır.

Yeni kod için bağımlılık yönü `ui/services → application → domain`, dış kaynak erişimi için `application → enjekte edilmiş callback ← adapters` biçimindedir. Global script düzeni nedeniyle yön yalnız klasör adına güvenmez; `scripts/check-architecture.mjs` domain ve application içindeki doğrudan altyapı kaçaklarını denetler.

## Bugünkü fiziksel alanlar

```text
src/
├── bootstrap/                 # uygulama başlatma
├── config/                    # ortam, sözlük, sabitler ve kilitli protokol
├── contracts/                 # surface-analysis ve surface-review DTO sınırları
├── core/                      # dar, eski global API uyumluluk parçaları
├── domain/                    # admin, auth, backup, export, map, parks, reports,
│                               # surface, trees, visitors, waypoints ve diğer alanlar
├── application/               # aynı alan aileleri için use-case/orkestrasyon
├── adapters/                  # alan bazlı veri ve platform erişimi
├── ui/                        # mevcut ekran/komponent/controller modülleri
├── services/                  # geçiş facade'ları; yeni iş mantığı eklenmez
├── utils/                     # küçük çapraz-katman yardımcıları
└── workers/                   # yüzey ve grid worker'ları
```

`src/domain/{surface,trees,parks,reports}` gibi alan ayrımları hedeflenen `lulc/`, `inventory/`, `carbon/` kavramlarının karşılığıdır; eşanlamlı klasörler açılmaz. Örneğin `surface/` hem WorldCover sınıflarını hem Sentinel-2 kanıtını içerir, `trees/` ise ölçüm ve allometriyi ayırır. `ui/` bugün dosya bazlıdır; `ui/pages`, `ui/components` veya `ui/pwa` ayrımı ancak aynı türde yeterli modül birikip yükleme sırası ve test sınırı netleşince yapılır. `en/` statik sayfa/dil katmanıdır; çalışma zamanı sözlükleri `config/` içindedir.

## Geçiş sırası

1. Önce davranış sahibi fonksiyonu ve kilitli regresyonlarını belirle; test dosyalarını modülleme gerekçesiyle oynatma.
2. Saf kararları `domain/`a, sıralı iş akışını `application/`a, dış erişimi `adapters/`a, sunumu `ui/`a taşı. Eski servis API'sini ince bir facade olarak bırak.
3. Yeni script'i `partials/head.html` içinde bağımlılıklarından sonra ve facade'dan önce yükle; `index.html`i build script'iyle üret; `sw.js` precache ve cache sürümünü güncelle.
4. Modül kontrat testini, ilgili eski regresyonları ve tam `npm run check` paketini çalıştır. Çekirdek değişikliklerini lock manifestinde önceki/yeni hash ile kaydet.
5. Bir klasör taşıması ancak gerçek bir katman/alan sınırını iyileştiriyor, bütün script/test/worker/CSP referansları birlikte güncelleniyor ve PR'da doğrulanabiliyorsa yapılır. Çoklu alanı tek committe yeniden adlandırma yapılmaz.

Önerilen `supabase/`, `sentinel2/`, `worldcover/`, `zenodo/` alt klasörleri yerine mevcut alan bazlı adapter yolları korunur (`adapters/parks`, `adapters/surface`, `adapters/reports`). Teknolojiye göre ayrım aynı iş akışının parçalarını farklı ağaçlara dağıtır; alan bazlı yerleşim, değişen bir kullanım senaryosunun adapter ve testini birlikte bulmayı kolaylaştırır.

## Mimari karar kayıtları ve sınır denetimi

Yeni kalıcı mimari kararlar `docs/adr/NNNN-kisa-ad.md` içinde durum, bağlam, karar ve sonuçlarıyla tutulur. `npm run check:architecture`, domain/application yasaklı doğrudan bağımlılıklarını denetler; yeni bir legacy ihlali ortaya çıkarsa kuralı gevşetmek yerine çağrı sınırı açıkça incelenir.

## Uygulanmış ilk ayrım

- `config/i18n-en.js`, Türkçe anahtarlarla İngilizce karşılıkların sabit sözlüğünü taşır; `config/i18n.js` yalnızca ters sözlük, DOM çevirisi, kalıcılık ve dil değişimi davranışını yönetir. Sözlük, çalışma zamanı çeviricisinden önce yüklenir.

- `domain/trees/allometry.js`, Chave allometrisi, karbon katsayıları ve hacim denklemini saf fonksiyon olarak taşır.
- `application/trees/calculate-tree-carbon.js`, yoğunluk çözümünü enjekte edilen bağımlılık olarak alır ve domain hesabını çağırır.
- `application/trees/calculate-tree-carbon-from-circumference.js`, kilitli çevre/DBH protokolünü ve karbon akışını enjekte edilen portlarla sıralar; saha API'si korunur.
- `application/trees/validate-measurement.js`, proje/nokta/ölçüm numarası ile grup/tür/çevre/boy kapısının sırasını yönetir; limitleri kopyalamaz, yoğunluk ve ölçüm protokolü adapter'larına sorar.
- `adapters/trees/fetch-owned-measurement-projects.js` ve `fetch-shared-measurement-projects.js`, sahip ve collaborator proje okumalarını mevcut ilişki seçimi, eski şema yedeği ve park-scope filtreleriyle yürütür; `domain/trees/merge-measurement-projects.js` owner-first listeyi saf biçimde birleştirir.
- `application/trees/load-measurement-project-directory.js` okuma, birleştirme ve sunum sırasını yönetir; `ui/render-measurement-project-directory.js` seçim kutularını, sayaçları, sahip/paylaşılan kartları ve boş durumu çizer. `services/measure.js` mevcut global API, rapor senkronu ve park/ölçüm kapılarını korur.
- `application/trees/measurement-project-state.js`, proje dizini için `getState/setState/subscribe` sunan ilk feature-scoped store'dur; `PROJ_LIST` mevcut modüllere uyum için aynalanır. `domain/trees/build-measurement-project-write.js`, `adapters/trees/persist-measurement-project.js`, `application/trees/save-measurement-project.js` ve `ui/measurement-project-edit-form.js` yazma payload'ını, RLS adapter'ını, use-case sırasını ve düzenleme formunu birbirinden ayırır.
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

- `domain/park-invites/access-policy.js`, sahip ve ortak parkları ayırır ve ekip yönetimi yetkisini sahip park kimliğiyle sınırlar.

- `adapters/park-invites/store.js`, davet/park/ortak okumalarını ve üç davet RPC çağrısını mevcut tablo, filtre, sıralama ve gövde sözleşmeleriyle yürütür.

- `ui/park-invite-inbox.js` ve `ui/park-collaboration-panel.js`, davet gelen kutusunu, ortak erişim bandını ve sahip ekip panelini mevcut HTML/kaçış kurallarıyla üretir.

- `application/park-invites/manage-invites.js`, davet kabul/red, gönderme ve geri alma sonuç sırasını veri deposu ve arayüz callback’leriyle yönetir; erişim denetimi sunucu RPC’lerinde kalır.
- `application/park-invites/load-owned-parks.js`, `v_my_parks` verisini önbellek ve eksik şema davranışını koruyarak yükler.
- `application/park-invites/load-recipient-invites.js`, gelen bekleyen davetleri oturum e-postasına göre büyük/küçük harf duyarsız süzer.
- `application/park-invites/load-owner-collaborations.js`, oturum, sahip parkları ve seçili parkı ekip yenilemesine hazırlar.
- `application/park-invites/refresh-collaborations.js`, sahiplik kapısından sonra davet ve ortak kayıtlarını yükleyip durumu günceller.
- `ui/owner-park-options.js`, sahip parkı seçeneklerini kaçış ve seçili değer davranışıyla üretir.
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
- `domain/parks/distance-to-park-boundary.js`, `decide-park-geofence.js`, `adapters/parks/read-fresh-gps-fix.js`, `domain/parks/stamp-geofence-decision.js` ve `application/parks/verify-at-park.js`, kilitli `geofence.js` doğrulama akışının sırasıyla sınır ölçümü, saf kararı, GPS okuması, audit damgası ve kullanıcı mesajlarını ayırır. Servis eski global API'yi korur; sabit eşikler, daire yedeği ve sunucu çiti değişmez.
- `application/parks/share-detailed-coverage-request.js`, `commit-park-coverage-snapshot.js`, `collect-park-coverage-elements.js`, `domain/parks/filter-park-coverage-to-boundary.js` ve `ui/park-water-layer-renderer.js`, `park-query.js` detaylı OSM kapsamını istek paylaşımı, park-sınırı cache/sonuç kaydı, eleman toplama, geometri kırpma ve su katmanı çizimi olarak ayırır.
- `domain/parks/normalize-overpass-cache-key.js`, `adapters/parks/coalesce-overpass-requests.js`, `domain/parks/select-overpass-mirrors.js`, `domain/parks/overpass-request-budget.js` ve `adapters/parks/overpass-mirror-health.js`, kilitli `osm-client.js` sorgu eşleştirme, tekilleştirme, ayna seçimi, zaman sınırı ve karantina davranışlarını modülerleştirir.
- `domain/surface/geometry-bounds.js`, `utm-projection.js`, `clip-polygon-rect.js`, `clip-polygon-convex.js` ve `projected-geometry-area.js`, tembel yüklenen `lc-geo.js` matematiğini sınırlar, projeksiyon, kırpma ve alan hesaplarına ayırır; lazy chain ve Service Worker precache sırası korunur.
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
- `domain/visitors/build-presence-payload.js`, Realtime Presence için kullanıcı, görünüm, cihaz, sınırlı oturum geçmişi ve yalnız mevcut GPS verisini içeren geçici yükü kurar; yük veritabanına yazılmaz.
- `adapters/visitors/presence-channel.js`, ziyaretçi Presence kanalını kullanıcı/oturum anahtarıyla açar, sync ve status callback'lerini bağlar; subscribe akışı JWT beklemeden başlar.
- `adapters/visitors/remove-presence-channel.js`, eski Presence kanalını Supabase istemcisinden kaldırır ve cleanup reddini yalıtır.
- `adapters/visitors/track-presence.js`, presence payload'ını etkin kanala yollar ve yalnız geçerli nesil için durum/transport hatasını bildirir.
- `application/visitors/upgrade-presence-auth.js`, subscribe başladıktan sonra oturumu arka planda okur ve bağlantı nesli hâlâ güncelse Realtime JWT'sini yükseltir.
- `domain/visitors/summarize-live-visitor-counts.js`, geçici canlı oturum listesinden çevrimiçi ve geçerli konum sayılarını DOM bağı olmadan çıkarır.
- `domain/visitors/build-live-location-trail.js`, presence içindeki konum izini doğrular, son 30 geçerli koordinatla sınırlar ve çizgi başlangıcını belirler.
- `application/visitors/render-owner-live-view.js`, kurucu/yetki, görünürlük ve duraklatma kapılarından sonra sayaç, roster, akış ve harita portlarını sırayla çalıştırır.
- `ui/visitor-live-panel.js`, mevcut bağlantı durumunu ve süzülmüş ziyaretçi roster'ını panel callback'lerine aktarır.
- `ui/visitor-live-map.js`, mevcut Leaflet harita/katman kurulumunu, geçici konum izlerini, işaretçileri ve takip/fit davranışını yönetir.
- `domain/visitors/presence-retry-delay.js`, canlı bağlantı yeniden deneme gecikmesini mevcut üst sınır ve üstel artış kuralıyla belirler.
- `application/visitors/start-presence-session.js`, Presence kanalını JWT beklemeden açar; nesil denetimi, durum callback'i, heartbeat ve watchdog'u bağlar.
- `application/visitors/stop-presence-session.js`, nesli geçersiz kılar, yaşam döngüsü timer'larını temizler ve eski kanalı kaldırır.
- `application/visitors/fail-presence-session.js`, bağlantı hatasını görünür yapar ve sınırlı geri çekilme aralığıyla yeniden bağlanmayı planlar.
- `application/visitors/resume-presence-session.js`, çevrimiçi/sekme görünür olduğunda bağlantıyı yeniden başlatır veya hazır oturuma yeni heartbeat gönderir.

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

- `application/visitors/load-owner-activity.js`, owner görünümündeki saklı ziyaret etkinliğini yükler, mevcut kurucu/çeviri/kaçış bağlarını kullanarak satırları üretip çizer; erişim ve DOM bağları çağıranda kalır.
- `application/visitors/load-owner-counts.js`, owner sayaç yükleme akışındaki izin kapısını, mevcut sayaç deposunu ve üç DOM güncellemesini hata yalıtımıyla koordine eder.
- `application/visitors/refresh-owner-view.js`, presence'i sürdürme, canlı listeyi çizme ve sayaç/etkinlik yüklemelerini paralel başlatma sırasını koruyarak yenileme kilidini `finally` içinde kaldırır.
- `application/visitors/live-refresh-timer.js`, ziyaretçi sekmesi için 10 saniyelik çizim zamanlayıcısını başlatıp durdurur; görünüm kontrolü ve timer erişimi çağırandan sağlanır.
- `application/visitors/focus-live-location.js`, owner ve geçerli konum kapılarından sonra takip seçeneğini kapatıp canlı haritayı 16. yakınlaştırmaya odaklar.

- `application/admin/refresh-tree-pending-badge.js`, bekleyen ölçüm sayısını tek exact/head sorgusuyla okur ve sorgu hatalarını mevcut sessiz-rozet yedeğiyle sınırlar.
- `application/admin/open-pending-tree-nodes.js`, yalnız bekleyen park, proje ve kullanıcı düğümlerini açık duruma getirerek ağaç görünümünü yeniden çizer.
- `application/admin/expand-measurement-tree.js`, filtrelenmiş ağacın tüm düğümlerini açar veya kapatır ve açık anahtar kümesini mevcut kuralla günceller.
- `application/admin/apply-tree-row-status.js`, moderasyon sonrası satır durumunu ve paylaşılan bilgisini yerel önbellekte güncelleyip ağaç ile düz listeyi yeniden çizer.
- `application/admin/remove-tree-row.js`, silinen ölçümü yerel ağaç önbelleğinden çıkarıp iki mevcut yönetim görünümünü yeniden çizer.

- `ui/visitor-connection-status.js`, bağlantı metnini, görünen/toplam kullanıcı sayısını, mevcut Türkçe saat biçimini ve durum rengini günceller; duraklatma metni aynı API içindedir, presence/filtre/görünürlük ve pause durumu serviste kalır.

- `domain/data-requests/find-pending-duplicate.js`, talep ülke/şehir/proje filtrelerini mevcut trim ve küçük harf kuralıyla karşılaştırır ve ilk eşleşmeyi döndürür; kullanıcı/status sorgusu, uyarı ve insert akışı serviste kalır.

- `domain/data-requests/summarize-dataset.js`, talep yanıtının kayıt sayısını, mevcut karbon toplamını ve tekil ülke/şehir kümelerini saf olarak üretir; onaylı veri filtreleme, CSV, e-posta metni ve tamamlanma kaydı serviste kalır.

- `adapters/data-requests/submit-store.js`, kullanıcı/status ile sınırlı bekleyen talep okumasını ve mevcut insert çağrısını taşır; tekrar kuralı, form gövdesi, hata sınırları ve arayüz akışı serviste kalır.

- `adapters/data-requests/fulfillment-store.js`, talep→proje→onaylı ölçüm okuma zincirini mevcut eşleştirme ve opsiyonel ülke/şehir filtreleriyle yükler; eşleşmeyen projede `[-1]` filtresi korunur, özet/CSV/e-posta ve tamamlanma serviste kalır.

- `adapters/data-requests/options-store.js`, talep formu için onaylı ölçüm ülke/şehir listesini exact count ve 5000 sınırıyla, projeleri ad sırasıyla paralel okur; durum atama, kesilme uyarısı ve seçenek zinciri serviste kalır.

- `adapters/data-requests/my-requests-store.js`, oturumdaki kullanıcının taleplerini mevcut user_id filtresi ve azalan created_at sırasıyla okur; oturum kapısı, kaydırma koruması, hata/boş görünüm ve silme eylemi serviste kalır.

- `adapters/data-requests/status-store.js`, talep durumunu ve fulfilled_at değerini mevcut id filtresiyle günceller; onay, zaman üretimi, CSV/e-posta sırası ve hata/yenileme politikası serviste kalır.

- `domain/data-requests/partition-queue.js`, yönetici kuyruğunu mevcut Tamamlandı/Reddedildi kuralıyla açık ve kapalı listelere ayırır; sıra ve kayıt kimliği korunur, sorgu/sayaç/HTML/kaydırma serviste kalır.

- `ui/data-request-pending-table.js`, aktif taleplerin mevcut etiketli tablo satırlarını, not satırını ve boş görünümünü üretir; sorgu, kuyruk ayrımı, sayaçlar ve işlem fonksiyonları serviste kalır.

- `adapters/data-requests/reply-window.js`, hazır yanıtı mevcut mailto/UTF-8 gövde kodlamasıyla _blank hedefinde açar; önceden kodlanan konu, metin, CSV ve tamamlanma sırası serviste kalır.

- `adapters/data-requests/queue-store.js` ve `ui/data-request-closed-table.js`, yönetici sorgusunu ve kapalı tabloyu gerçek sınırlara ayırır. Kullanıcı talimatıyla iki kaynak-konumu regresyonu yeni modülleri ve servis delegasyonunu denetleyecek şekilde taşındı; önceki/yeni test hashleri çekirdek manifestinde kaydedildi, diğer 265 kilit korunur.

- `ui/my-data-requests.js` ve `adapters/data-requests/delete-own-request.js`, kullanıcı talep kartlarını ve id+user_id ile sınırlı silme çağrısını ayırır; oturum, onay, hata, kaydırma ve yenileme serviste kalır. workspace-theme regresyonu aynı şartları yeni modüllerde ve servis bağlantısında denetler; RLS migration şartları korunur. Bu test hash manifestinde bulunmadığı için manifest değişmedi.

- `ui/data-request-reply-content.js`, talep yanıtının tam e-posta metnini ve kodlanmış konu satırını mevcut tarih, özet, QGIS/lisans ve künye içeriğiyle üretir; veri sorgusu, CSV, tarayıcı ve durum güncellemesi serviste kalır.

- `application/data-requests/fulfill-request.js`, veri yükleme→özet→boş onayı/CSV→yanıt→tamamlanma→bildirim→yenileme sırasını enjekte edilen portlarla yönetir; Supabase, DOM ve tarayıcı erişmez, servis bağımlılıkları bağlar.

- `application/data-requests/submit-request.js`, tekrar kontrolü→kayıt gövdesi→insert→sonuç sırasını enjekte edilen portlarla yürütür; tekrar kontrolü hata sınırı korunur, form/metin/yenileme serviste kalır.

- `application/data-requests/delete-own-request.js`, oturum/geçerli ID→onay→id+user_id silme→sonuç→yenileme sırasını enjekte edilen portlarla yönetir; mesajlar, adapter ve liste yenilemesi servisten bağlanır.

- `application/data-requests/reject-request.js`, ret onayı, durum sonucu ve bildirim/yenileme sırasını enjekte edilen portlarla yönetir.

- `application/data-requests/load-options.js`, seçenek yükleme, durum atama, kesilme uyarısı ve ülke/şehir yenileme sırasını mevcut sessiz hata sınırıyla yönetir.

- `application/data-requests/load-own-requests.js`, oturum kapısı, kullanıcıya bağlı yükleme ve hedef/hata/boş/dolu sonuç ayrımını yönetir; kaydırma sarmalı serviste kalır.

- `application/data-requests/load-queue.js`, kuyruk yükleme, açık/kapalı ayrımı, sayaçlar ve tablo çizim sırasını portlarla yönetir; kaydırma ve DOM serviste kalır.

- `ui/data-request-submission-feedback.js`, tekrar/hata/başarı form mesajını ve durum rengini mevcut çeviri sözleşmesiyle gösterir; toast, form temizleme ve yenileme serviste kalır.

- `adapters/users/admin-store.js`, profiles listeleme ve rol/aktiflik güncellemelerini mevcut sorgu gövdeleriyle taşır; yetki kapıları serviste kalır.

- `domain/users/summarize-admin-users.js`, kullanıcı sayaçlarını mevcut aktiflik ve kurucu/denetçi sınıflandırmasıyla saf olarak üretir.

- `ui/admin-user-table.js`, korunan kurucu satırı, salt okunur denetçi görünümü ve mevcut etkileşim/etiket/kaçış sözleşmesiyle kullanıcı tablosunu üretir.

- `ui/admin-user-filter.js`, Türkçe arama, rol ve aktiflik koşullarını satır görünürlüğüne uygular; görünür sayaç serviste kalır.

- `application/users/load-admin-users.js`, admin/owner kapısını ve liste/cache/sayaç/çizim/filtre sırasını portlarla yönetir; hata/scroll/DOM serviste kalır.

- `adapters/backup/paged-store.js`, 1000 satırlık sıralı tam dökümü ve tablo adıyla hata üretimini korur; eski fetchAllRows köprüsü serviste kalır.

- `domain/backup/build-snapshot.js`, yedek schema/DOI/tarih/kullanıcı alanlarını ve kayıt sayılarını ham satırları değiştirmeden üretir.

- `adapters/backup/json-download.js`, application/json indirmesini, geçici anchor yaşam döngüsünü ve 5000 ms URL temizliğini mevcut biçimde uygular.

- `application/backup/create-full-backup.js`, yetki, sıralı tam veri yükleme, isteğe bağlı talepler, belge/indirme/kayıt/bildirim akışını portlarla yönetir.

- `domain/backup/reminder-state.js`, mevcut yedi gün eşiğini, eksik/geçersiz tarih ve gün yuvarlama davranışını saf olarak hesaplar.

- `domain/backup/sql-value.js`, SQL literal değerlerini NULL, sonlu sayılar, boolean ve tek tırnak kaçış kurallarıyla serileştirir.

- `domain/backup/build-restore-sql.js`, geri yükleme tablolarını mevcut sırayla, güvenli sütun tanımlayıcıları ve idempotent insertlerle SQL'e dönüştürür.

- `ui/restore-backup-prompt.js`, geri yükleme onayındaki ölçüm, proje, waypoint, talep ve dışa aktarma tarihini mevcut Türkçe metne bağlar.

- `adapters/backup/download-restore-sql.js`, SQL dosyasını geçici anchor ve beş saniyelik URL temizliğiyle indirir.

- `application/backup/restore-backup.js`, onay, SQL üretimi, boş yedek sonucu ve indirme callback sırasını portlarla yönetir; servis fallback'i izole test ortamlarında korunur.

- `domain/reports/publication-link.js`, yalnız biçimi doğrulanmış DGR kimliğinden kanonik rapor bağlantısı kurar; günlükteki URL değeri kullanılmaz.

- `adapters/reports/publication-log-store.js`, yayın günlüğünü her istekte cache-buster ve `no-store` ile okur; HTTP, JSON ve ağ hatalarında mevcut boş sonuç davranışını korur.

- `adapters/reports/publication-request-store.js`, bekleyen yayın isteklerini mevcut alanlar, en yeni önce sırası ve 50 satır sınırıyla okur; şema/hata sunumunu servis belirler.

- `adapters/reports/park-comparison-store.js`, karşılaştırma görünümünü karbon sırasıyla okur ve yalnız kimlikli, bekleyen olmayan, kayıt içeren parkları döndürür.

- `adapters/reports/retraction-store.js`, geri çekme isteklerini mevcut alanlar ve azalan tarih sırasıyla okur; tablo/taşıma hatalarında boş liste yedeğini korur.

- `adapters/reports/publication-cancel-store.js`, bekleyen isteği mevcut `Vazgeçildi` durumu ve iptal zamanı ile yalnız istek kimliğinden günceller; yetki ve hata bildirimi servis katmanında kalır.

- `adapters/reports/user-publication-request-store.js`, kullanıcı rapor panelinin park kapsamındaki son on isteğini mevcut alanlar ve azalan tarih sırasıyla yükler.

- `adapters/reports/own-approved-measurements-store.js`, panelin bilgi amaçlı sayaç sorgusunu exact/head ve proje/kullanıcı/onaylı/silinmemiş filtreleriyle çalıştırır.

- `adapters/reports/user-retraction-store.js`, kullanıcı panelindeki park geri çekme isteklerini mevcut on satır sınırıyla okur; eksik tablo ve taşıma hatalarında boş listeyi korur.

- `application/reports/load-user-publication.js`, park kapsamındaki istek hatası/state güncellemesini ve kuyruk/sayaç/geri çekme okumalarının render/poll sırasını portlarla yürütür.

- `domain/reports/publication-request-error.js`, istek API hata metinlerini mevcut şema, RLS, kota ve sahiplik açıklamalarına dönüştürür; tek çevrilebilir tekrar iletisi çeviri portunu kullanır.

- `application/reports/request-publication.js`, yönetici ve kullanıcı isteklerinde ortak collect/null/başarı/hata sırasını portlarla yürütür; her iki çağrı noktasının yetki ve arayüz tepkileri servis katmanında kalır.

- `application/reports/cancel-publication-request.js`, izin→onay→iptal yazımı→hata/başarı callback sırasını yönetir; rol ve kullanıcı sahipliği kapıları çağıran serviste korunur.

- `adapters/reports/retraction-insert-store.js`, geri çekme POST'unu kullanıcı oturum JWT'si, `Prefer: return=minimal` ve mevcut istek gövdesiyle taşır; RLS kararları Supabase'te kalır.

- `domain/reports/retraction-request-error.js`, geri çekme API hata kodlarını mevcut Türkçe kullanıcı mesajlarına çevirir.

- `application/reports/open-user-publication-panel.js`, giriş/proje/park kapılarını ve seçili park panelini açma sırasını servis portlarıyla yönetir.

- `application/reports/close-user-publication-panel.js`, panel kapanırken zamanlayıcıyı durdurur, seçili kimlikleri sıfırlar ve görünümü temizler.

- `application/reports/sync-user-publication-panel.js`, proje listesi güncellendiğinde seçili proje silinmişse paneli kapatır.

- `application/reports/schedule-user-publication-poll.js`, yalnız kullanıcının tamamlanmamış isteği varken sınırlı yoklamayı ve görünürlük kapılarını uygular.

- `application/reports/share-report-link.js`, doğrulanmış rapor bağlantısını paylaşır veya yeni sekmede açar; paylaşım API'si, pano ve prompt sırasını korur.

- `domain/reports/resolve-publication-park-status.js`, her park için bekleyen istek, yayın, geri çekme ve son başarısızlık kayıtlarından görünür durumu belirler.

- `ui/render-publication-park-row.js`, durum modelini mevcut rozet, bağlantı, DOI ve işlem düğmesi ailesiyle güvenli tablo satırına dönüştürür.

- `ui/render-publication-history.js`, son altı yayın/geri çekme kaydını kimlik biçimi doğrulaması ve kaçışlamayla listeler; geri çekilmiş yayına ölü bağlantı üretmez.

- `application/reports/summarize-publication-queue.js`, bekleyen istek, aktif yayın, DOI ve çözülmemiş hata sayılarını üretir.

- `ui/render-publication-admin-card.js`, özet, hata uyarıları, park tablosu, yayın günlüğü ve değişmezlik yardımını yönetici kartında birleştirir.

- `application/reports/resolve-user-publication-view.js`, kullanıcı paneli için bekleyen/başarısız istek, yayın ve geri çekme önceliğini görünüm modeline çevirir.

- `ui/render-user-publication-controls.js`, paylaş/aç/geri çek/iptal/yeni yayın düğmeleriyle arazi örtüsü seçeneğini mevcut buton ailesinde üretir.

- `ui/render-user-publication-header.js`, park raporu başlığını, durum rozetini, notu ve doğrulanmış kalıcı bağlantıyı çizer.

- `ui/render-user-publication-notices.js`, kullanıcıya ait onaylı ölçüm sayacı, çevrimdışı notu ve yayın/geri çekme açıklamasını üretir.

- `ui/render-user-publication-card.js`, şema uyarısını ve kullanıcı panelinin hata, başlık, eylem ve bilgi parçalarını birleştirir.

- `application/reports/load-publication-queue.js`, park, istek, günlük ve geri çekme okumalarını paralel yükleyip mevcut state/render/poll sırasını korur.

- `application/reports/schedule-publication-queue-poll.js`, yönetici kartındaki bekleyen yayın/geri çekme işleri için sınırlı ve görünürlük kontrollü yoklamayı yönetir.

- `application/reports/request-report-retraction.js`, kimlik ve oturum kapısı, onay, gerekçe, insert ve sonuç callback sırasını yürütür.

- `application/reports/refresh-after-report-retraction.js`, başarılı geri çekmeden sonra açık yönetici ve kullanıcı görünümlerini yeniler.

- `application/reports/reset-publication-polling.js`, geri çekme sonrası iki panelin yoklama sayaçlarını başa alır.

- `adapters/reports/publication-request-insert-store.js`, istek POST'unu oturum JWT'si, anon yedeği ve `Prefer: return=minimal` ile yürütür; RLS reddi ve ağ sonucunu mevcut biçimde döndürür.

- `domain/reports/normalize-report-orcid.js`, ORCID URL/boşluk normalizasyonunu ve ISO 7064 kontrol basamağını tek domain sınırında hesaplar.

- `domain/reports/clean-report-context.js`, yayın künyesi alan uzunluklarını, kontrol karakteri temizliğini ve bağımsızlık bayrağını korur.

- `domain/reports/validate-report-context.js`, temizlenmiş künyenin zorunlu alan, tarih ve ORCID kurallarını doğrular.

- `domain/reports/decode-report-context.js`, şema, geçerlilik ve açık yayın onayı koşulları sağlanınca kayıtlı künyeyi döndürür.

- `application/reports/resolve-academic-profile-defaults.js`, eski ve yeni hesap metadata alanlarını temizlenmiş profil varsayılanlarına dönüştürür.

- `ui/academic-profile-fields.js`, örnek balonlu etiket ve form kontrollerini mevcut akademik profil sınıflarıyla üretir.

- `ui/render-academic-profile.js`, kişi/kurum özeti, ORCID bağlantısı ve profil düzenleme formunun HTML'ini oluşturur.

- `application/reports/save-academic-profile.js`, ORCID doğrulaması, Supabase Auth güncellemesi, durum mesajları ve profil yenileme sırasını yönetir.

- `application/reports/create-academic-report-collector.js`, kullanıcı/park tekilleştirme anahtarını ve rapor künye toplama portlarını kurar.

- `application/reports/resolve-report-question-values.js`, park adını, kullanıcı/park taslağını ve akademik form değerlerini mevcut öncelik kurallarıyla çözer.
- `ui/report-question-fields.js`, rapor yayın künye formunun sıralı akademik, tarih, amaç, örnekleme ve cihaz alanlarını mevcut sınıf ve kaçış bağlarıyla üretir.
- `ui/report-question-confirmations.js`, DOI kapsam bilgisini, açık yayın/onay kutularını, hata bölgesini ve form eylemlerini çizer.
- `application/reports/validate-report-question-answer.js`, tarayıcı doğrulamasını, temizlenmiş rapor bağlamı denetimini ve taslağın yalnız geçerli yanıtta saklanmasını koordine eder.
- `application/reports/run-report-question-dialog.js`, erişilebilir modalın iptal, kapatma, form gönderme ve önceki odağa dönüş yaşam döngüsünü yönetir.

- `adapters/admin/admin-tree-store.js`, yönetim ölçümlerini tam embed, istemci tarafı join ve görünür hata yedeğiyle yükler.

- `domain/admin/group-measurement-tree.js`, ölçümleri park → proje → kullanıcı hiyerarşisinde toplar ve sıralar.

- `domain/admin/filter-measurement-tree.js`, yönetim ağacını durum ve Türkçe arama sorgusuna göre süzer.

- `ui/admin-tree-formatters.js`, karbon, bekleyen rozeti, durum özeti ve durum etiketlerini üretir.

- `ui/admin-tree-pending-summary.js`, bekleyen kayıtları park/proje/kullanıcı düzeyinde özetleyip yönetim kısayollarını çizer.

- `ui/admin-tree-measurement-row.js`, ölçüm değerlerini, görsel önizlemeyi ve moderasyon işlemlerini satıra dönüştürür.

- `ui/admin-tree-user.js`, kullanıcı ölçüm tablosunu ve bekleyen/onay/red özetini üretir.

- `ui/admin-tree-project.js`, proje düğümünü, kullanıcı alt ağacını ve yetkili silme eylemini çizer.

- `ui/admin-tree-park.js`, park düğümünde alan, t/ha ve proje toplamlarını sunar.

- `ui/admin-tree-view.js`, ağaç hata/boş durumlarını, özet sayaçlarını ve genişletme eylemlerini çizer.

- `application/admin/load-admin-tree.js`, yetkili yükleme, ilk yükleme durumu, scroll koruması, sorgu hatası/uyarıları ve çizim hatasını tek akışta koordine eder; servis eski global API’yi ve DOM metinlerini korur.

- `application/admin/update-admin-tree-filter.js`, durum, metin araması ve bekleyen kısayolu değişikliklerini tek redraw sırasıyla uygular.

- `application/admin/set-admin-tree-node-open.js`, ağaç düğümlerinin açık/kapalı anahtar kümesini günceller.

- `application/admin/navigate-admin-tree-pending-scan.js`, özet satırındaki park tarama eyleminde olay yayılımını durdurup yönetim ekranına dönüş bilgisini taşır.

- `application/admin/delete-admin-tree-project.js`, yönetici onayı, proje silme sonucu, canlı harita geçersizleştirme ve görünüm yenileme sırasını yönetir; RLS sunucu kararını korur.

- `application/visitors/toggle-activity-disclosure.js` ve `restore-activity-disclosure.js`, etkinlik görünürlüğünü ve cihazdaki `dg_vis_act_open` tercihini mevcut render sırasıyla yönetir; storage hatası görünümü bozmaz.

- `application/visitors/update-live-visitor-filters.js`, canlı arama/ekran/konum filtrelerini sıfırlama ve hızlı görünüm seçimlerini uygular.

- `application/visitors/set-live-visitor-pause.js`, canlı panelin duraklatılmış durumunu korurken yeniden çizim ve duraklatma göstergesi callback'lerini seçer.

- `application/visitors/fit-live-visitor-map.js`, kullanıcı haritaya sığdırma istediğinde fit bayrağını sıfırlar, mevcut filtreyi uygular ve sonucu harita çizicisine aktarır.

- `domain/export/resolve-export-options.js`, CSV/QGIS/GeoJSON indirme adlarını, aktivite etiketlerini ve önizleme başlıklarını tek biçim tablosunda çözer.

- `application/export/serialize-measurement-export.js`, CSV/QGIS çıktısını mevcut CSV üreticisine, GeoJSON çıktısını mevcut GeoJSON üreticisine bağlar; önizleme seçeneklerini korur.

- `adapters/export/file-download.js`, metni `Blob` ve object URL ile indirme bağlantısına aktarır; `export.js` mevcut `dl` globalini korur.

- `application/export/download-user-measurement-export.js`, aktivite bildirimi, kullanıcının tüm sayfalanmış satırlarını okuma, serileştirme ve dosya indirme sırasını yönetir.

- `application/export/prepare-user-measurement-preview.js`, CSV veya GeoJSON önizlemesi için aynı kullanıcı sorgusu ve biçim kurallarını kullanıp mevcut önizleme UI’sine veri hazırlar.

- `ui/admin-measurement-row.js`, düz moderasyon listesindeki tek ölçüm satırını mevcut işlem düğmeleri ve kaçışlama ile üretir.

- `ui/admin-measurement-table.js`, düz listeyi proje/nokta/ölçüm sırasına koyar ve 300 satır sınırını korur.

- `domain/admin/export-filter-options.js`, ölçüm ve proje verilerinden ülke, şehir ve proje filtre seçeneklerini üretir.

- `domain/export/measurement-row.js`, ölçüm satırını mevcut Türkçe tarih/saat, karbon, fotoğraf adı ve DBH hassasiyetiyle CSV alanlarına dönüştürür.

- `domain/export/build-measurement-csv.js`, mevcut başlığı, UTF-8 BOM'u, satır sırasını ve son satır sonunu koruyarak tam CSV üretir.

- `domain/export/build-measurement-geojson.js`, tam dışa aktarım ve hafif önizleme GeoJSON özellik kümelerini üretir; koordinat sırası [boylam, enlem] kalır.

- `adapters/export/measurement-store.js`, kullanıcının ölçümlerini mevcut `owner` filtresi, azalan created_at sırası ve 1000 satırlık sayfalama ile okur.

- `ui/export-preview.js`, CSV'nin ilk 100 satırını veya 20.000 karakterlik GeoJSON metnini mevcut önizleme modalına kaçışlamayla bağlar.

- `application/admin/build-export-query.js`, seçili ülke/şehir/proje/durum değerlerini mevcut Supabase sorgu zincirine uygular.

- `application/admin/read-export-rows.js`, dışa aktarım sorgusunu sıralı sayfalarla okur ve hata mesajını korur.

- `ui/admin-measurement-filter.js`, yönetim listesindeki satırları mevcut küçük/büyük harf duyarsız arama kuralıyla gösterir veya gizler.
- `ui/fill-admin-export-select.js`, dışa aktarım seçimlerini mevcut Tümü seçeneği, kaçış ve seçim değerini koruma davranışıyla doldurur.
- `application/admin/load-admin-export-filters.js`, ölçüm ve proje filtre verilerini paralel yükleyip mevcut hata yalıtımıyla uygular.
- `application/admin/update-admin-export-filter-options.js`, ülke → şehir → proje seçicilerinin kademeli yenileme sırasını ve proje kimliklerini korur.
- `application/admin/download-admin-measurements.js`, filtrelenmiş ölçümleri CSV, ayrıntılı QGIS CSV veya GeoJSON dosyası olarak indirir; boş sonuç uyarılarını ve başarı akışını çağırana bırakır.
- `adapters/admin/admin-overview-store.js`, yönetici sayfasının profil/ölçüm/proje/genel görünüm sorgularını ve toplam ölçüm sayımını aynı paralellik/sıra ile yürütür.
- `domain/admin/summarize-admin-overview.js`, yönetici sayaçlarının tek özet modelini hesaplar.
- `ui/admin-overview-metrics.js`, dört yönetici özet sayısını mevcut DOM alanlarına yazar.
- `ui/admin-overview-measurements.js`, ölçüm sorgu hatasını mevcut açıklamayla gösterir veya düz moderasyon tablosunu çizer.
- `application/admin/load-admin-overview.js`, rol kapısını, özet yükleme/render sırasını ve yönetici alt panellerinin yenilenmesini yönetir.

- `domain/auth/is-oauth-callback.js`, OAuth dönüşünü code, access token veya hata parametreleriyle tanır.
- `domain/auth/read-oauth-error.js`, OAuth hata parametresini çözümler.
- `application/auth/wait-for-oauth-session.js`, Supabase auth olayları, mevcut oturum ve zaman aşımını aynı bekleme akışında birleştirir.
- `application/auth/clean-oauth-url.js`, OAuth dönüşünden sonra adres çubuğundaki parametreleri temizler.
- `ui/oauth-wait-indicator.js`, Google oturum geçişi sırasında bekleme metnini gösterip gizler.
- `application/auth/login-with-password.js`, parola girişini captcha, profil yükleme ve çevrimdışı senkron sırasını koruyarak yürütür.
- `application/auth/register-account.js`, kayıt alanlarını ve KVKK açık rıza zaman damgasını Supabase signup isteğine taşır.
- `application/auth/send-password-reset-email.js`, captcha doğrulamasıyla parola sıfırlama bağlantısını ister ve mevcut hata mesajlarını korur.
- `application/auth/sign-out.js`, varlık kapatma, Supabase çıkışı ve sayfa yenilemeyi sırayla yürütür.
- `application/auth/save-new-password.js`, parola eşleşmesi/uzunluğu doğrulamasını, güncellemeyi ve başarılı çıkışı yönetir.
- `application/auth/show-password-recovery.js`, yalnız Supabase `PASSWORD_RECOVERY` olayında mevcut recovery modalını görünür yapar.
- `ui/show-auth-panel.js`, erişim paneline kaydırma, sekme seçimi ve geçici odak vurgusunu mevcut süreyle yürütür.
- `application/auth/select-auth-tab.js`, form görünürlüğünü, seçili Turnstile sekmesini ve widget yenileme sırasını koordine eder.
- `ui/render-auth-message.js`, mevcut auth mesaj metnini ve hata/başarı rengini DOM'a yazar.
- `application/auth/start-google-sign-in.js`, Google provider seçimi, origin/path tabanlı redirect, hesap seçme prompt'u ve hata sonrası düğme/bekleme durumu akışını yönetir.
- `application/parks/start-park-scan.js`, ölçümden gelen park algılama yönlendirmesini, park modunu ve gecikmeli harita/kart odağını koordine eder.
- `application/parks/focus-park-scan-target.js`, hedef projenin geçerli ölçüm noktalarına haritayı oturtur; sonuç yoksa GPS görünümüne döner.
- `domain/parks/select-park-scan-step.js`, kayıtlı park ve geçici aday durumuna göre kart adımını üretir.
- `ui/preview-park-project-name.js`, park adı ve etiket değişince mevcut proje adı önizlemesini günceller.
- `application/parks/cancel-park-scan.js`, algılama yönlendirme durumunu temizleyip önceki ekrana döner.

- `application/admin/read-photo-storage-usage.js`, fotoğraf deposundaki klasörleri sayıp dosya boyutu ve adet toplamını üretir.

- `ui/admin-storage-usage.js`, depolama kullanımını mevcut kota renkleri ve çevrilmiş sayaç metniyle gösterir.

- `application/admin/clean-orphan-photos.js`, ölçüm kayıtlarına bağlı olmayan herkese açık fotoğraf URL'lerini bulup depodan kaldırır.

- `application/admin/re-geocode-measurements.js`, koordinatı geçerli satırları sırayla yeniden kodlar ve istek aralığını korur.

- `domain/admin/measurement-geojson.js`, ölçüm satırlarını aynı özellik alanları ve DBH hassasiyetiyle GeoJSON'a dönüştürür.

- `ui/park-comparison-row.js`, park karşılaştırma satırını mevcut mobil sınıflar, karbon ve alan başına değerlerle çizer.

- `ui/park-comparison-pending.js`, henüz park kimliğine bağlanmamış kayıtları rol bilgisine uygun eylem/bilgiyle gösterir.

- `ui/park-report-options.js`, bağlı parkları ve bekleyen projeleri rapor seçim listesine güvenli biçimde aktarır.

- `ui/park-comparison-error.js`, şema bayrağına dokunmadan yetki/ağ hatası için mevcut hata kartını üretir.

- `application/world/fit-measurement-rows.js`, doğrulanmış ölçüm koordinatlarına haritayı oturtur ve boş sonuç bildirimini üretir.

- `domain/parks/summarize-park-report.js`, seçili park ölçümlerinden karbon, çap/boy, grup, tür ve proje özetini çıkarır.

- `ui/park-report-summary.js`, park raporunun başlık, özet kartı, alan yoğunluğu ve birleşik proje bilgilerini çizer.

- `ui/park-report-species-table.js`, tür istatistiklerini mevcut rapor tablosu alanlarıyla sunar.

- `domain/parks/build-park-report-csv.js`, aynı park künyesi ve tür satırlarıyla UTF-8 BOM'lu CSV üretir.

- `ui/park-report-preview.js`, rapor başlığını, gövdesini, indirme eylemini ve önizleme modalını bağlar.

- `domain/parks/resolve-park-report-target.js`, seçili park kimliğini veya eski proje adı seçeneğini rapor hedefine dönüştürür.

- `domain/parks/build-park-report-request.js`, park kimliğiyle bütün projeleri kapsayan `!inner` sorgu isteğini kurar.

- `domain/parks/build-legacy-park-report-request.js`, eski şema için proje adına dayalı sınırlı yedek sorgu isteğini kurar.

- `adapters/parks/park-report-store.js`, park raporu sorgusunu çalıştırır ve birincil hata durumunda eski şema yedeğine geçer.

- `application/world/load-park-report.js`, seçim, sorgu, kesilme uyarısı ve rapor çizimi sırasını yönetir.

- `domain/users/record-status-meta.js`, kullanıcı ölçüm durumunun etiketini ve sınıfını belirler.

- `domain/users/group-own-records.js`, kullanıcının ölçümlerini Türkçe proje adına ve nokta/ölçüm sırasına göre gruplar.

- `ui/record-item.js`, kullanıcı kayıt satırının metrik, durum ve eylem HTML'ini üretir.

- `ui/record-project.js`, proje bazlı kayıt listesinin toplam ve durum özetini çizer.

- `adapters/users/own-records-store.js`, oturum sahibinin ölçümlerini proje adıyla Supabase'den okur.

- `domain/users/summarize-tree-analysis.js`, ölçüm grubuna, çap/boya ve tür sıklığına göre analiz verisini toplar.

- `ui/tree-analysis.js`, grup yüzdelerini, ortalama ölçüleri ve en yaygın altı türü mevcut kart biçiminde çizer.

- `adapters/world/world-stats-store.js`, genel, ülke ve şehir istatistik görünümlerini mevcut sırayla okur.

- `ui/world-stats-tables.js`, ülke ve şehir istatistik satırlarını güvenli biçimde üretir.

- `application/dashboard/load-own-records.js`, mevcut sahip-kayıt deposu ve gruplama alanından proje bazlı kayıt kartlarını üretir; scroll sarmalı servis katmanında kalır.
- `application/dashboard/delete-own-record.js`, yalnız sunucu silmeyi doğruladıktan sonra fotoğrafı temizler, görünür kayıt/panel görünümlerini yeniler ve harita kirini işaretler.
- `application/dashboard/load-owner-dashboard.js`, ölçüm kayıtlarından panel sayısı/karbon toplamını çıkarır ve ilk on noktayı grafik ile analiz görünümüne aktarır.
- `ui/dashboard-chart.js`, Chart.js'i tembel yükleme bağından sonra açar; mevcut paleti, grafik seçeneklerini ve önceki grafiği yok etme davranışını korur.
- `application/dashboard/load-world-dashboard.js`, ülke/şehir istatistiklerini ve onaylı işaretçi analizini mevcut hata kutusu ve harita kirletme akışıyla koordine eder.

- `ui/world-error.js`, dünya verisi hatasını ve yeniden deneme eylemini gösterir.

- `adapters/world/park-comparison-store.js`, park görünümünü, eski şema için onaylı ölçüm yedeğini ve ülke/şehir yakınlaştırma sorgularını mevcut kolon, filtre ve limitlerle yürütür.
- `domain/parks/resolve-park-comparison-read.js`, park karşılaştırma okumasını başarılı, eski şema yedeği veya yetki/ağ hatası olarak sınıflandırır.
- `application/world/load-park-comparison.js`, birincil görünümü yükler ve yalnız şema eksikliğinde eski yola geçer; yetki/ağ hatasında yedek sorgu çalıştırmaz.
- `application/world/render-primary-park-comparison.js`, park satırlarını mevcut linked/pending sunum portlarına ve rapor seçicisine aktarır.
- `application/world/load-legacy-park-comparison.js`, eski şema için onaylı ölçüm yedeğini mevcut 5.000 satır uyarısıyla yükler ve legacy gruplama portuna verir.
- `application/world/show-park-comparison-denied.js`, yetki/ağ hatasını mevcut kaçışlı hata kartı ve uyarı bildirimiyle gösterir; park şema bayrağına dokunmaz.

- `domain/parks/prepare-park-comparison.js`, park kimliği olan satırları ve bekleyen satırları ayırıp karbon sıralı çubuk ölçeğini üretir.

- `domain/parks/group-legacy-park-comparison.js`, eski şemada ölçümleri proje adına göre karbon, kayıt, çap ve boy toplamlarında toplar.

- `ui/legacy-park-comparison.js`, eski şema bilgilendirmesini, proje karşılaştırma satırlarını ve geçici rapor seçeneklerini güvenli biçimde çizer.

- `application/world/zoom-to-location.js`, harita, sayfalı olmayan konum sorgusu, kesilme uyarısı ve mevcut fit callback sırasını yönetir.

- `domain/admin/measurement-review-payload.js`, ölçüm onayı ve reddi için durum/paylaşım alanlarını kurar.

- `adapters/admin/measurement-moderation-store.js`, ölçüm moderasyon yazılarını, fotoğraf okumayı ve silmeyi Supabase'e aktarır.

- `application/admin/review-measurement.js`, onay/red komutunu mevcut moderasyon deposuna gönderir.

- `application/admin/override-measurement-geofence.js`, yönetici konum çiti istisnasını audit kimliğiyle kaydeder.

- `application/admin/delete-measurement.js`, kaydı silmeden önce bağlı fotoğrafı temizler ve ölçümü kaldırır.

- `domain/auth/resolve-turnstile-form.js`, seçili auth sekmesini Turnstile widget kimliğine dönüştürür.

- `adapters/auth/load-turnstile-script.js`, Cloudflare Turnstile kaynağını tek sefer yükler ve başarısızlığı sıfırlar.

- `ui/turnstile-widget.js`, yalnız etkin form widget'ını gösterir ve önceki widget'ı kaldırır.

- `application/auth/turnstile-controller.js`, form görünürlük zamanlamasını ve widget yaşam döngüsünü yönetir.

- `domain/auth/read-turnstile-token.js`, seçili form token'ını güvenli biçimde okur.

- `domain/visitors/presence-ping-window.js`, geçici Realtime presence güncellemelerinde 10 saniyelik gönderim sınırını ve zorunlu yenileme geçişini saf kurala ayırır.
- `application/visitors/record-presence-view.js` ve `record-presence-action.js`, yalnız değişen görünüm olayını veya önemli kullanıcı eylemini bellekteki oturum olaylarına yazar ve anlık presence yenilemesini tetikler.
- `ui/visitor-view-labels.js` ve `visitor-action-labels.js`, canlı ziyaretçi görünümü ve aktivite akışının ortak Türkçe etiketlerini tek sunum kaynağında tutar.

## LULC doğrulama modülleri — 13 Ekim 2026

- `domain/surface/validation-sampling.js`, deterministik PRNG ile tabakalı ve park-geneli doğrulama örneklerini üretir.
- `domain/surface/validation-accuracy-metrics.js`, alan ağırlıklarını, hata matrisini ve Olofsson doğruluk/belirsizlik ölçülerini hesaplar.
- `domain/surface/validation-spectral-rules.js`, IBI, hassasiyet eşiklerini ve Sentinel-2 sınıf tahminini uygular.
- `application/surface/build-validation-agreement.js`, spektral uzlaşmayı ve mevcut doğrulama kapısı hükmünü kurar.
- `application/surface/serialize-validation-campaign.js`, kampanyayı CSV/JSON'a aktarır ve insan kararlarından doğrulanmış alan/GeoJSON üretir.
- CSV satır modeli `domain/surface/build-validation-campaign-csv-rows.js` içinde kurulur; BOM/yeni satır biçimini `application/surface/serialize-validation-campaign-csv.js` korur. JSON şema biçimi ayrı `serialize-validation-campaign-json.js` modülündedir.
- `domain/surface/apply-validation-campaign-corrections.js` sınıf alanı geçişlerini, `build-validation-corrected-geojson.js` ise insan kararları ve spektral bulgular için denetim özelliklerini üretir.
- `services/lc-validate.js`, dış global API'yi ve IndexedDB kampanya kalıcılığını koruyan uyumluluk adapter'ıdır; modüller lazy zincirde ve service-worker precache'te ondan önce yüklenir.

## Sentinel-2 kanıt modülleri — 13 Ekim 2026

- `domain/surface/select-sentinel-scenes.js`, aynı MGRS tile/gün tekrarlarını ayıklar ve sahneleri tarih ile tile kapsamı boyunca dengeli seçer; STAC aramasını GET olarak yürütür.
- `domain/surface/sentinel-temporal-windows.js`, WorldCover referans sezonunu ve seçilen yılın ilkbahar/sonbahar su kalıcılık pencerelerini kurar.
- `domain/surface/sentinel-raster-grid.js`, her COG'un kendi UTM EPSG'sinde park penceresini ve hücre indekslerini hesaplar.
- `domain/surface/sentinel-spectral-evidence.js`, PB04 yansımasını, medyanı, iki tarihli ekstrem kanıtını ve bitki özeti değerlerini üretir.
- `application/surface/build-sentinel-profile.js`, günlük gözlemleri hücre kompozitlerine ve yıllık profil istatistiklerine dönüştürür.
- `services/lc-s2.js`, sahne/bant okuma sırasını ve uyumlu `DG_LC_S2` globalini korur; beş modül lc-validate sonrasında, lc-s2 öncesinde yüklenir.

## OSM land-cover kanıt modülleri — 13 Ekim 2026

- `adapters/surface/load-osm-landcover-evidence.js`, aynı parkın kapsamını yeniden kullanır, bekleyen istekleri paylaşır ve sınırlı OSM su yedeğini yönetir.
- `domain/surface/extract-osm-water-polygons.js`, way ve relation dış halkalarını mevcut `[lat,lon]` biçiminde çıkarır.
- `application/surface/refine-water-by-osm.js`, açık su poligonlarıyla sınıf/sayaç alanlarını birlikte günceller ve ham raster izini korur.
- `domain/surface/osm-road-policy.js`, izinli sert yüzey etiketlerini, yol tiplerini ve genişlik varsayılanlarını değerlendirip OSM yol özelliklerini hazırlar.
- `application/surface/refine-hard-by-osm.js`, park EPSG'sinde yol-hücre temasını ölçer ve yalnızca mevcut sınıf/alan sözleşmesi içinde sert sınıf düzeltmesi yapar.
- `services/lc-osm.js`, eski global fonksiyonları korur; modüller `lc-engine.js` sonrasında ve servis öncesinde yüklenir.

## STAC ve COG ağ modülleri — 13 Ekim 2026

- `domain/surface/stac-fetch-policy.js`, STAC JSON çağrılarının transient retry, iptal aktarımı ve toplam zaman sınırını yönetir.
- `adapters/surface/open-raster-range.js`, GeoTIFF COG byte-range isteklerini aralık başlıkları, yeniden deneme ve gövde yaşam döngüsüyle taşır.
- `adapters/surface/sign-stac-assets.js`, SAS token imzasını uygular ve koleksiyon başına süreli token cache'ini tutar.
- `domain/surface/select-stac-tiles.js`, STAC GET URL'sini kurar, yıllık ürün filtresini ve GeoTIFF asset seçimini uygular.
- `domain/surface/resolve-raster-window.js`, görüntü metadata'sını ve sınır dışına taşmayan park piksel penceresini hesaplar.
- `services/lc-stac.js`, geriye uyumlu `dgLc*` API'sini tutar; modüller `lc-geo.js` sonrasında, STAC servisi öncesinde yüklenir.

## Park proje geçişleri — 13 Ekim 2026

- `domain/parks/select-park-project.js`, seçili DOM değerini proje kimliğiyle çözer; mevcut numeric ID eşleşmesini korur.
- `adapters/parks/park-scan-redirect-memory.js`, proje başına sekme oturumunda tek yönlendirmeyi ve storage engellendiğinde güvenli geri dönüşü yönetir.
- `application/parks/complete-park-project-link.js`, proje listesi yenileme, seçicileri güncelleme, tarama state'ini temizleme ve kaynak ekrana dönüş sırasını yürütür.
- `application/parks/handle-park-project-change.js`, son seçim, canlı park presence, ölçüm kapısı ve uygun nokta önerisi sırasını korur.
- `application/parks/handle-park-drawn.js`, çevrimiçi kayıt/çevrimdışı bildirim, aktif aday ve park state'i ile kart yenilemesini yönetir.

## Park yönetim state'i ve sunumu — 13 Ekim 2026

- `application/parks/park-admin-state.js`, park kimlikleri ekranının satır, boş park görünürlüğü ve son sorgu bağlamını değişmez snapshot ve `subscribe` ile tutar; servis global adları geçiş uyumluluğu için aynalar.
- `adapters/parks/sync-park-project-names.js`, bilinen park adını kullanır veya gerekiyorsa park adını okur, ardından projelerin park adı alanını aynı RLS sorgu kapsamıyla günceller.
- `ui/render-park-admin.js`, state, mevcut overview hesabı ve satır renderer'ını birleştirir; görünür ekran yoksa mevcut erken dönüşü korur.
- `application/parks/refresh-park-admin-views.js` ve `toggle-park-admin-empty.js`, yönetim değişikliği sonrası yenileme ile boş park filtresi state/render sırasını yönetir.

## Ölçüm GPS aktivasyonu — 13 Ekim 2026

- `adapters/trees/measurement-geolocation.js`, konum izni sorgusu, ilk fix ve canlı watch tarayıcı API'lerini enjekte edilen navigator üzerinden sağlar.
- `ui/measurement-gps-status.js`, mevcut GPS mesajı, hata durumunda tekrar dene butonu/rozeti ve toast davranışını korur.
- `application/trees/handle-measurement-gps-error.js`, izin reddi, timeout tekrar denemesi ve diğer GPS hatalarının mevcut mesaj/sırasını yürütür.
- `adapters/trees/measurement-wake-lock.js`, destek varsa tekil ekran kilidini alır, release sonrasında yeniden alınabilmesini sağlar.
- `application/trees/start-measurement-gps.js`, iOS yardımından izin ve busy durumu, ilk konum, canlı izleme, presence ve wake lock sırasını yönetir; eski `startGps()` globali servis facade'ında kalır.

## Ölçüm fotoğraf kanıtı denetimi — 13 Ekim 2026

- `application/trees/measurement-photo-check-state.js`, fotoğraf denetim nesillerini ve temizleme/değişim sonrası eski sonuçların geçersizliğini tutar.
- `adapters/trees/read-measurement-photo-pixels.js`, tarayıcı canvas okumasını izole eder ve örnekleme için kullanılan object URL'yi kapatır.
- `ui/measurement-photo-check.js` ve `ui/measurement-photo-file.js`, mevcut Türkçe durum mesajları, seçili dosya adı ve temizleme kontrollerini sunar.
- `application/trees/check-measurement-photo.js`, görsel türü ve kalite kapısı, asenkron iptal ve UI geri bildirim sırasını birleştirir; `measure.js` eski global girişini ve kilitli tarama/eşik fonksiyonlarını korur.

## Ölçüm GPS görünümü — 13 Ekim 2026

- `domain/trees/format-measurement-gps-readout.js`, GPS doğruluk sınıfı, koordinat hassasiyeti, yükseklik ve mevcut rozet biçimini saf olarak üretir.
- `ui/measurement-gps-readout.js` ayrıntı alanlarını; `ui/measurement-gps-active-state.js` aktif GPS mesajı, düğmesi ve rozetini günceller.
- `adapters/trees/update-measurement-gps-map-marker.js`, mevcut konum işaretini harita API'si arkasında değiştirir.
- `application/trees/refresh-measurement-gps-view.js`, form, durum, harita, navigasyon ve otomatik nokta önerisi sırasını birleştirir; servis `updGps()` uyumluluk girişini korur.

## LULC doğrulama kampanyası kalıcılığı — 13 Ekim 2026

- `adapters/surface/validation-campaign-store.js`, `DendroGeoValidate` IndexedDB veritabanının `campaigns` object store işlemlerini ve park kapsamlı okumayı taşır.
- `application/surface/validation-campaign-archive.js`, servis API'sini adapter üzerinden kurar; `validation-campaign-save-queue.js` başarısız kayıt sonrasında da yerel taslak sırasını sürdürür.
- `application/surface/handle-validation-campaign-save-failure.js`, yalnız hâlâ etkin kampanyanın cihaz yazma hatasını gösterir.
- `domain/surface/select-validation-campaign.js`, owner ve fingerprint eşleşmesiyle geçerli park kampanyasını veya taşınabilir eski cihaz taslağını seçer. `lc-validate.js` eski global API ve bağımsız bilimsel hesapları korur.

## LULC yüzey fırçası — 13 Ekim 2026

- `domain/surface/select-surface-brush-cells.js`, metrik fırça çizgisini park geometrisine kırpar ve yalnız raster hücreleriyle gerçek kesişimleri seçer.
- `domain/surface/create-surface-cell-decision.js`, mevcut `visual-cell` düzeltme kaydını aynı alanlarla kurar; geçerli sınıfları UI sözleşmesinden alır.
- `application/surface/surface-brush-history.js`, yirmi darbeli geçmiş sınırını ve yalnız hâlâ aynı darbeye ait hücreleri geri alan undo davranışını tutar.
- `application/surface/migrate-legacy-brush-masks.js`, eski sürekli fırça poligonlarını kesişen hücre kararlarına taşır; park dışı geometriyi ve çözümlenemeyen maskeleri korur.
- `domain/surface/surface-geometry-overlap.js`, pahalı kesin kesişim öncesi bounds filtresini sağlar. Kilitli `lc-sens.js` eski global girişlerini koruyarak modülleri birleştirir.

## LULC rapor sunumu — 13 Ekim 2026

- `domain/surface/normalize-landcover-report-result.js`, raporun güncel ve eski sonuç DTO'larını ortak görünüm girdisine eşler.
- `domain/surface/build-landcover-report-model.js`, sınıf sırası, alan/pay, çapraz uzlaşma, nesne ve park alanı QA değerlerini HTML'den bağımsız hazırlar.
- `ui/render-landcover-report-rows.js` sınıf barlarını; `ui/render-landcover-report-metadata.js` QA, maske, kapsam ve kaynak satırlarını üretir.
- `ui/compose-landcover-report.js` tek blok HTML'i kurar. `lc-report.js` eski global fonksiyonu koruyup sunum modüllerini birleştirir.

## LULC OSM nesne incelemesi — 13 Ekim 2026

- `domain/surface/find-surface-object-at-point.js`, doğrulanmış cihaz geometrisi yedeğini ve en küçük içeren OSM nesnesini seçer; park kırpması ve kesin doğrulama devam eder.
- `domain/surface/create-selected-object-boundary.js`, seçilen geometriyi mevcut `visual-boundary` provenance alanlarıyla kayıt girdisine dönüştürür.
- `ui/surface-object-preview.js` Leaflet önizleme katmanını kurup temizler; `application/surface/handle-surface-object-pick.js` tıklama, uyarı ve önizlemeye geçiş sırasını yürütür.
- `application/surface/apply-surface-object-boundary.js`, cihaz taslağını ilk kaydeder, su sınırı gerekiyorsa dış raster hücrelerini tarar ve yalnız ayrı kabul çağrısında hesabı günceller.

## LULC elle sınır çizimi — 13 Ekim 2026

- `domain/surface/surface-boundary-point-policy.js`, mevcut park nokta denetimini ve destek yokken korunan devam davranışını tutar.
- `domain/surface/prepare-surface-boundary.js`, halkayı doğrular, park geometrisine kırpar ve 0,1 m² alt sınırını uygular.
- `ui/surface-boundary-drawing-preview.js`, geçici çizgi, kapanış kenarı ve köşe işaretlerini üretir.
- `application/surface/surface-boundary-drawing-session.js`, harita çizim oturumunu başlatır, en fazla 300 noktayı kabul eder, geri alma ve iptali yönetir.
- `application/surface/finish-surface-boundary-drawing.js`, mevcut feature payload'ını cihaza kaydeder ve gerekirse su dış hücre taramasını başlatır.

## LULC hücre karar akışı — 13 Ekim 2026

- `domain/surface/build-cell-decision-popup-model.js`, hücre alanı, sınıf seçimi ve geri alma durumunu popup görünüm modeline dönüştürür.
- `ui/render-cell-decision-popup.js`, mevcut sınıf sırası, eylem adları ve kaçışlanmış metinle popup HTML’sini üretir.
- `application/surface/apply-surface-cell-decision.js`, doğrulanmış tekli kararı uygular; toplu değişiklikler aynı tekli girişten her hücreyi sırayla geçirir.
- `application/surface/undo-surface-cell-decision.js` ve `reset-surface-corrections.js`, sahiplik kapıları, geri alma ve onaylı sıfırlama akışını yürütür.
- `lc-sens.js` eski global girişlerini korur; yeni modüller servis öncesi lazy yüklenir ve çevrimdışı precache’e alınır.

## LULC spektral kanıt ve NDVI sunumu — 13 Ekim 2026

- `domain/surface/classify-surface-scan-audit.js`, Sentinel‑2 profiliyle değişmez ham raster sınıflarını karşılaştırıp eksik/belirsiz kapsam ve alan sıralı farkları üretir.
- `ui/render-surface-scan-audit.js`, tarih aralığı ve kaçışlanmış kapsam/fark açıklamasını raporlar; bağımsız doğruluk ölçümü olmadığını açıkça korur.
- `domain/surface/classify-surface-vegetation-tiers.js`, en az üç gözlemli yeşil hücrelerden park içi NDVI tercillerini kurar; `build-surface-vegetation-parts.js` yalnız hazır geometrili sınıfları birleştirme girdisine taşır.
- `ui/render-surface-vegetation-features.js`, çözülmüş poligonları mevcut Leaflet katmanına çizer. `lc-sens.js` orkestrasyon, uyumluluk girişi ve ham sınıf korumasını sürdürür.

## LULC kabul edilmiş sonuç akışı — 13 Ekim 2026

- `domain/surface/evaluate-surface-acceptance-gate.js`, ham görünüm, çizim, meşgul durum ve çözümlenmemiş su hücrelerini mevcut öncelik sırasıyla değerlendirir.
- `domain/surface/create-surface-acceptance-draft.js`, hücre düzeltmelerini ve alanları dondurulmuş kabul adayına taşır; özgün geometri kimliklerini korur.
- `application/surface/build-surface-result-snapshot.js`, tüm park alanı korunumu doğrulandıktan sonra yayın geometri snapshot’ını üretir.
- `application/surface/accept-surface-analysis.js`, epoch/kayıt eskime kapılarını, hesap yazımını, cihaz taslağı yedeğini ve sonuç durumunu yürütür.
- `ui/render-surface-accepted-result.js`, hesapta kabul edilmiş alanları rapor host’una sunar; kilitli servis uyumluluk globalini korur.

## LULC yüzey fırçası etkileşimi — 13 Ekim 2026

- `adapters/surface/surface-brush-pointer-session.js`, birincil pointer capture, geçici çizgi/daire önizlemesi ve harita sürükleme/zoom kilidini yönetir.
- `domain/surface/validate-surface-brush-stroke.js`, WGS84 noktaları, 300 nokta sınırı, desteklenen sınıf ve çapları doğrular.
- `application/surface/commit-surface-brush-stroke.js`, seçilen hücre kararlarını provenance ve sınırlı geçmişle kaydeder; `undo-surface-brush-stroke.js` yalnız hâlâ kendi darbelerine ait hücreleri geri alır.
- `application/surface/update-surface-brush-config.js`, geçerli sınıf/çap seçimini güncelleyip etkin pointer oturumunu kapatır. Kilitli UI globali orkestrasyon uyumluluğunu korur.

## LULC ana düzenleyici paneli — 13 Ekim 2026

- `domain/surface/build-surface-editor-view-model.js`, tarama hazır oluşu ve meşgul/kayıt kapılarını görünüm modeline indirger.
- `ui/render-surface-scan-panel.js`, tarama düğmesi, Sentinel‑2 kapsamı ve kanıt açıklamasını üretir.
- `ui/render-surface-sensitivity-controls.js`, dört sınıf kaydırıcısını ve opaklık kontrolünü mevcut sırada kurar.
- `ui/render-surface-review-actions.js`, kabul, ham görünüm ve durum alanlarını oluşturur; `ui/compose-surface-editor-panel.js` alt görünümleri sabit DOM sırasıyla birleştirir.

## LULC ham/düzenleme görünüm geçişi — 13 Ekim 2026

- `domain/surface/is-surface-raw-view-transition-allowed.js`, eksik kayıt, meşgul/kayıt/dışa aktarma ve yinelenen görünüm taleplerini kapatır.
- `domain/surface/capture-surface-edit-view-snapshot.js`, aynı park nesli için hazırlanmış geometri ve görsel memo referanslarını yakalar.
- `application/surface/prepare-surface-raw-view-transition.js`, fırça/çizim/nesne oturumlarını durdurup yalnız geçici görünüm state’ini sıfırlar.
- `application/surface/restore-surface-edit-view-cache.js`, uyumlu düzenleme geometrisini yeniden kullanır; `switch-surface-raw-view.js` geçişi, yeniden bölümlendirme yedeğini ve özeti yönetir.

## LULC spektral tarama orkestrasyonu — 13 Ekim 2026

- `adapters/surface/load-surface-water-objects.js`, park kapsamlı OSM yanıtından yalnız doğrulanmış su/havuz geometrilerini seçer.
- `application/surface/apply-auto-surface-water-objects.js`, otomatik maskeleri mevcut repartition use-case’inden geçirir ve başarısız geometri kurulumunu geri alır.
- `domain/surface/build-surface-scan-summary.js`, yeterli gözlem, sınıf farkı ve belirsiz su sınırı mesajlarını üretir.
- `application/surface/complete-surface-scan.js` başarılı profili kaydeder; `run-surface-scan.js` scan gate, nötr başlangıç, stale park koruması ve finally cleanup sırasını orkestre eder.

## LULC dışa aktarma — 13 Ekim 2026

- `domain/surface/build-surface-export-data.js`, mevcut alan sırasını ve GeoJSON provenance alanlarını koruyarak CSV/GeoJSON gövdelerini üretir.
- `domain/surface/prepare-surface-export-map-frame.js`, hücre ve park halkalarının UTM kapsamından aynı ölçekli canvas koordinatlarını hesaplar.
- `ui/render-surface-export-layer-dialog.js`, park, analiz, grid ve waypoint seçimlerini mevcut erişilebilir kontrollerle sunar.
- `ui/draw-surface-export-map-layers.js`, seçili yüzey, park, grid ve waypoint katmanlarını çizim sırasıyla boyar; `ui/render-surface-export-infographic.js` başlık, alan özeti, lejant ve lisans dipnotunu üretir.

## LULC kayıt yükleme — 13 Ekim 2026

- `domain/surface/create-surface-review-record.js` park/owner başına boş kaydın mevcut varsayılanlarını kurar; `application/surface/load-local-surface-review-draft.js` kapsamlı cihaz taslağını ve parmak izi eşleşen eski taslağı bulur.
- `domain/surface/select-surface-review-source.js` yalnız daha yeni ve açıkça kirli cihaz taslağına hesap snapshot’ı karşısında öncelik verir.
- `domain/surface/normalize-surface-review-record.js` duyarlılıkları sınırlar, düzeltme/feature alanlarını doğrular ve tutarsız kabul edilmiş snapshot’ı reddeder.
- `application/surface/load-surface-review-record.js`, cihaz/hesap kaynaklarını ve eski UI durum mesajlarını orkestre eder.

## LULC su sınırı incelemesi — 13 Ekim 2026

- `domain/surface/surface-water-footprint-policy.js`, açık elle çizilmiş ve parkla eşleşen doğrulanmış OSM su sınırlarını değerlendirir.
- `domain/surface/classify-surface-water-outside-cell.js`, sınır dışı raster su hücresini elle karar, spektral kanıt ve en yakın sınıflı grid komşusuna göre sınıflandırır.
- `domain/surface/select-surface-water-outside-parts.js` gözden geçirilmiş raster su parçalarını seçer; `count-unresolved-surface-water-parts.js` belirsiz hücreleri anahtarla tekilleştirir.
- `domain/surface/requires-surface-water-scan.js`, su sınırı ve profil durumuna göre gerekli yeniden taramayı belirler.

## LULC inceleme geometri ve alan özeti — 13 Ekim 2026

- `application/surface/build-surface-review-parts.js`, kayıt, geometri, profil ve görsel nesil aynı kaldığında çözülmüş parçaları memo’dan döndürür.
- `domain/surface/summarize-surface-review-areas.js` alan toplamlarını parçalarla eşler; `build-adjusted-surface-summary.js` ham raster tabanıyla düzeltilmiş sonucu birleştirir.
- `application/surface/render-surface-review-geometry.js` worker geometrisini önizleme, kabul ve dışa aktarma arasında yeniden kullanır; geçerli kabul geometrisi varsa onu tercih eder.
- `domain/surface/build-surface-boundary-geojson.js`, doğrulanmış kullanıcı sınırlarını parkla kesiştirir ve mevcut GeoJSON özellikleriyle dışa aktarır.

## LULC harita araç çubuğu — 13 Ekim 2026

- `domain/surface/build-surface-toolbar-model.js`, etkin araç, meşguliyet ve bitki görünümü durumunu menü/toolbar görünüm modeline indirger.
- `ui/render-surface-editor-menu-label.js` ve `render-surface-editor-panel-head.js`, ortak erişilebilir menü etiketi ve panel başlığı kalıbını sunar.
- `ui/render-surface-editor-menus.js`, dosya, görünüm, sınır, veri ve fırça menülerini mevcut kontrol kimlikleriyle üretir.
- `ui/render-surface-editor-tool-rail.js`, harita araç rayını ve menü/durum kabuğunu üretir.

## LULC harita etkileşimleri — 13 Ekim 2026

- `adapters/surface/surface-right-pan-session.js`, sağ tuş pointer oturumunu ve Leaflet pan hareketlerini yönetir; sol tuş çizim/fırça akışları ayrı kalır.
- `application/surface/select-surface-draw-type.js` ve `select-surface-brush-type.js`, desteklenen sınıf seçimini mevcut sınır/fırça kapılarıyla uygular.
- `application/surface/return-surface-to-hand-mode.js`, çizim ve fırçayı kapatıp normal harita modunu geri getirir.
- `application/surface/update-surface-opacity.js`, görünür dolgu opaklığını sınırlar ve var olan gecikmeli kayıt davranışını sürdürür.

## LULC harita ve tarama kontrolleri — 13 Ekim 2026

- `application/surface/select-surface-scan-period.js`, mevcut düzenleme kapılarını koruyarak dönem seçimini normalize eder ve taramayı başlatır.
- `application/surface/update-surface-sensitivity.js`, hassasiyet değerini sınırlar ve değişiklik sonrası harita/özet yenilemesini geciktirir.
- `application/surface/focus-surface-class.js` görüntülenen sınıf odağını; `toggle-surface-candidates.js` aday katmanı görünürlüğünü yönetir.
- `application/surface/select-surface-basemap.js`, yalnız OSM, uydu ve topo altlıkları arasında seçim yapar.

## LULC OSM nesne seçimi ve sınır önizlemesi — 13 Ekim 2026

- `domain/surface/select-surface-object-features.js`, ham görünüm hariç tutulduğunda OSM ayak izleri ve elle çizilmiş sınırları mevcut sırayla birleştirir.
- `application/surface/toggle-surface-objects.js`, değişikliği mevcut repartition ve taslak kayıt akışından geçirir.
- `application/surface/start-surface-object-pick.js` parkla eşleşen OSM kaynağını denetler ve harita seçim oturumunu başlatır; `cancel-surface-object-pick.js` tıklama dinleyicisiyle geçici katmanı temizler.
- `application/surface/apply-and-accept-surface-object-boundary.js`, sınır uygulaması ve taslak kaydı başarılı olmadan kabul adımına geçmez.

## LULC özet ve sonuç raporları — 13 Ekim 2026

- `domain/surface/summarize-surface-edit-impact.js`, elle hücre, hassasiyet, sınır, eşik ve görünüm değişikliklerini mevcut sayımlarla özetler.
- `application/surface/build-surface-report-model.js`, ham raster, canlı önizleme ve kabul edilmiş rapor için doğru başlık/yönlendirmeyi seçer.
- `ui/render-surface-area-bars.js`, sınıf alanı, yüzde, renk ve çevrilmiş etiketleri mevcut bar markup’ıyla üretir.
- `ui/render-surface-current-report.js`, mevcut rapor host’unu ve ilk ham rapor gövdesini koruyarak güncel özeti oluşturur.
- `ui/render-surface-accepted-report.js`, kabul edilmiş snapshot’ı var olan tarih, alan çubuğu ve yayın açıklamasıyla gösterir.

## LULC harita katmanı render akışı — 13 Ekim 2026

- `domain/build-surface-layer-render-key.js` epoch, partition, visual version ve edit durumundan deterministik cache anahtarı üretir; `is-surface-layer-render-current.js` geç kalmış işi reddeder.
- `ui/render-surface-display-polygons.js` Leaflet sınıf poligonlarını ve mevcut koordinat dönüşümünü üretir.
- `ui/handle-surface-display-layer-click.js` tıklamayı stale kapısı ardından OSM seçimi, çizim, fırça veya hücre incelemesine yönlendirir.
- `application/refresh-surface-review-layer.js` async geometri birleştirme, tekrar deneme, sınıf odağı, opaklık ve sınır/bitki overlay sırasını orkestre eder.

## LULC yeniden bölümlendirme ve geometri commit’i — 13 Ekim 2026

- `domain/build-surface-repartition-input.js`, park eşleşmesi olmayan OSM elementlerini ve ham görünüm düzenleme kapılarını dışlar.
- `domain/is-surface-repartition-current.js`, yalnız aynı editor epoch’una ait hazırlık sonucunun commit edilmesine izin verir.
- `application/commit-surface-repartition-result.js`, sınırları ve nesne sürümünü yazar; fırça maskesi göçünü uygular, parça hücrelerini kanonik hücre dizisine bağlar ve worker seed’i yeniler.
- `adapters/surface/clear-surface-review-layers.js` eski Leaflet gruplarını kaldırır; `application/repartition-surface-review.js` busy/render/finally akışını korur.

## Surface review mount lifecycle

The locked `src/ui/lc-sens.js` editor mount now delegates source fingerprint invalidation, stale-record reset, session state preparation, map host setup, and epoch-gated mount completion to five modules. The UI entry point still owns compatibility fallback behavior; all modules are loaded before it and included in the offline precache. Accepted snapshots remain untouched when the source fingerprint is unchanged.

## Park live Presence lifecycle

The locked map service delegates park Presence failure/retry policy, stable collaborator color selection, channel subscribe/auth setup, channel/layer teardown, and throttled location tracking to five modules. The adapter keeps subscription ahead of session JWT refresh; location payloads remain ephemeral and scoped to `dg-park-<parkId>`.

The collaborator map renderer now separates peer selection, display-model derivation, Leaflet layer reuse, marker rendering, and online-count presentation. The render path keeps Presence ordering, self-exclusion, coordinate checks, escaping, marker style, and tooltip age labels.

## Waypoint CSV yükleme — 13 Ekim 2026

- `domain/parks/parse-waypoint-csv.js` BOM, başlık, boş satır ve mevcut virgül ayrıştırmasını kapsar; `validate-waypoint-csv-row.js` koordinat sınırları ve pozitif integer waypoint kimliğini doğrular.
- `application/parks/build-waypoint-upsert-command.js` mevcut owner/proje/waypoint alanları ile `project_id,wp_id` çakışma anahtarını üretir; `adapters/parks/upsert-project-waypoint.js` aynı Supabase upsert işlemini yürütüp hatayı iletir.
- `application/parks/upload-waypoint-csv.js` satırları sıralı kaydeder, kısmi başarıyı bildirir ve mevcut listeyi yeniler. Kilitli servis aynı toast, kayıt sırası ve refresh davranışını koruyarak orkestrasyonu modüle devreder; kilitli regresyon testleri değiştirilmedi.


## Onaylı canlı harita yüklemesi — 13 Ekim 2026

- `domain/map/prepare-approved-map-measurements.js` mevcut koordinat politikasını kullanarak çizilebilir satırları seçer; `adapters/map/fetch-approved-map-measurements.js` onaylı kayıt sorgusunu ve kesilme uyarısını korur.
- `application/map/load-approved-measurement-markers.js` harita/okuma/çizim akışını ve `done(n, rows, error)` geri çağırım sözleşmesini sürdürür. `ui/render-live-map-load-status.js` yükleniyor, hata/yeniden dene ve normal/degrade durumlarını üretir; `application/map/load-live-measurements-map.js` yükleme durumu, analiz ve marker akışını orkestre eder.
- Kilitli `src/services/map.js` tüm beş modül mevcutken bu akışları devreder; eksik modül durumunda uyumluluk gövdesi çalışır. Veri alanları, RLS hatası bildirimi, kesilme uyarısı, marker çizim sırası ve canlı harita dirty/loaded kapıları korunur.


## Ölçüm marker katmanı ve parça çizimi — 13 Ekim 2026

- `domain/map/measurement-marker-cluster-icon.js` küme rozetinin görünümünü üretir; `ui/create-measurement-map-marker.js` yeşil ölçüm marker’ını ve mevcut popup’ı bağlar.
- `adapters/map/ensure-measurement-marker-layer.js` küme katmanını kurar/temizler ve eklenti yoksa düz katmana düşer; `application/map/schedule-measurement-marker-chunks.js` token kontrollü, 16 ms aralıklı çizim parçalarını yürütür.
- `application/map/add-measurement-markers.js`, bu dört modülü sırayla birleştirir. Var olan UI adapter’ı yeni modüller eksik olduğunda önceki yerel uygulamasına geri döner.


## Waypoint GPS canlı rehber — 13 Ekim 2026

- `domain/map/resolve-waypoint-gps-guidance.js` hedef yokken en yakın bekleyen noktayı seçer ve mesafe/yön modelini kurar; `ui/create-waypoint-gps-location-marker.js` mevcut konum pinini başlangıç hedefinin oku ile çizer.
- `ui/render-waypoint-gps-guidance-readout.js` mesafe, hedef ve okuma alanlarını; `adapters/map/add-waypoint-guidance-line.js` kesikli düz çizgiyi üretir.
- `application/map/render-waypoint-gps-overlay.js` marker, hedef seçimi, okuma ve çizgi adımlarını sıralar. Mevcut `waypoint-gps-overlay` modülü beş bağımlılık eksikse önceki yerel akışına döner; GPS kapalı akış ve çağrı sözleşmesi aynı kalır.


## Waypoint “Vardım” akışı — 13 Ekim 2026

- `domain/map/select-waypoint-arrival-target.js` etkin hedefi korur veya GPS ile en yakın bekleyen noktayı seçer; `ui/confirm-waypoint-arrival-distance.js` 50 m sınırındaki mevcut onayı yönetir.
- `adapters/map/mark-waypoint-visited.js` yalnız mevcut `id` filtresiyle `visited=true` yazar. `application/map/complete-waypoint-arrival.js` başarılı yazımdan sonra hedefi, ölçüm noktasını, harita listesini ve proje seçimini günceller.
- `application/map/arrive-at-waypoint.js` erken çıkışları, yazma hatasını ve başarı orkestrasyonunu yönetir. Kilitli servis tüm modüller mevcutsa devreder; eski gövde modül yüklenememe yedeği olarak durur.


## Waypoint proje listesi yüklemesi — 13 Ekim 2026

- `domain/map/select-restored-waypoint-target.js` yalnız aynı kimlikli ve bekleyen hedefi yeniden seçer; `adapters/map/fetch-project-waypoints.js` mevcut proje filtresi ve `wp_id` sırasını korur.
- `application/map/reset-waypoint-load-state.js` eski liste/hedefi temizler ve proje yokken mevcut ek çizimi sürdürür; `ui/show-waypoint-load-error.js` hata metnini ve toast türünü gösterir.
- `application/map/load-project-waypoints.js` yarışan proje sorgularını eski kapıdan geçirir, geçerli yanıtı state’e yazar ve önceki bekleyen hedefi geri yükler. Servis modüller eksikse yerel uyumluluk gövdesini kullanır.


## Waypoint listesini silme — 13 Ekim 2026

- `domain/map/is-waypoint-project-selected.js` proje seçimi kapısını tanımlar; `ui/confirm-waypoint-list-deletion.js` mevcut kalıcı silme uyarısını gösterir.
- `adapters/map/delete-project-waypoints.js` yalnız seçili `project_id` filtresiyle siler; `application/map/clear-deleted-waypoint-list.js` başarılı işlemden sonra hedef/liste state’ini temizler ve yeniler.
- `application/map/delete-project-waypoints.js` proje/iptal/hata/başarı adımlarını orkestre eder. Kilitli servis modüller hazır değilse mevcut akışını kullanmayı sürdürür.


## Harita başlangıç yaşam döngüsü — 13 Ekim 2026

- `domain/map/map-initial-view.js` üç görünümün merkez ve zoom değerlerini sağlar; `adapters/map/create-osm-map.js` Leaflet instance’ını kurar ve başlangıç görünümünü uygular.
- `ui/add-osm-map-layer.js` mevcut OSM karo URL’sini, attribution’ı ve zoom sınırını bağlar; `application/map/initialize-map-instance.js` oluşturmayı idempotent hale getirir ve instance’ı katman eklenmeden önce state’e yazar.
- `application/map/initialize-workspace-maps.js` ana, navigasyon ve dünya haritalarını mevcut sırayla başlatır. Kilitli servis eksik modül durumunda uyumluluk yolunu korur.


## Harita altlığı değiştirme — 13 Ekim 2026

- `domain/map/resolve-base-map-layer.js` OSM, uydu ve topoğrafik sağlayıcıların URL, etiket, attribution ve zoom sınırlarını üretir; `ui/sync-base-map-layer-selection.js` üç kontrolü ve LULC altlık state’ini senkronlar.
- `adapters/map/manage-base-map-layers.js` etkin altlığı bulur ve eski tile katmanlarını kaldırır; `adapters/map/create-base-map-layer.js` Leaflet katmanını var olan seçeneklerle kurar.
- `application/map/switch-base-map-layer.js` boş harita, geçersiz tür ve zaten etkin katman kapılarını korur; servis modül yoksa mevcut yedek akışını çalıştırır.

## Örnekleme grid orkestrasyonu — 13 Ekim 2026

- `domain/surface/validate-surface-grid-options.js` mevcut grid boyutu ve güvenlik mesafesi sınırlarını doğrular.
- `application/surface/prepare-surface-grid-domain.js` park, yeşil alan ve engelleri yerel UTM domain'inde birleştirir; `erode-surface-grid-domain.js` mevcut 16 yönlü clearance erozyonunu uygular.
- `application/surface/build-surface-sampling-grid-cells.js` kırpılmış bileşenlerden güvenli örnek noktalarını, WGS84 çizim geometrisini ve hücre meta verisini üretir; `run-surface-sampling-grid.js` use-case'i orkestre eder.
- Ana-thread lazy loader ve yüzey worker'ı bu modülleri `lc-review.js` öncesinde yükler. Servis içindeki önceki uygulama, bu modüller yüklenmediğinde uyumluluk yedeği olarak kalır.

## Yüzey inceleme çözümlemesi — 13 Ekim 2026

- `domain/surface/select-surface-review-features.js` yalnız tanımlı yüzey sınıflarını seçer; `application/surface/prepare-surface-review-feature-masks.js` overlay geometrisini aktif parkla kesiştirip park/CRS anahtarıyla maskeyi yeniden kullanır.
- `application/surface/resolve-surface-review-cell.js` son düzenlenen maskeden başlayarak sınıf parçalarını ve ölçülmüş alan paylarını üretir. `resolve-surface-review-parts.js` mevcut geometri cache kapılarını ve memo seeding’i orkestre eder.
- `domain/surface/summarize-surface-review-parts.js` raster hücre alanını çözülmüş parçalara aktarır. UI, worker ve offline önbellek bu modülleri servis öncesinde yükler; servis gövdeleri fallback olarak kalır.

## Yüzey koordinat ve park geometrisi — 13 Ekim 2026

- `domain/surface/snap-surface-review-coordinate.js` UTM koordinatını mevcut milimetre hassasiyetinde yuvarlar; `adapters/surface/project-surface-review-ring.js` `[lon,lat]` ringlerini enjekte edilen UTM dönüşümüne bağlar.
- `adapters/surface/unproject-surface-review-geometry.js` geometriyi WGS84'e çevirir ve EPSG'ye bağlı mevcut WeakMap önbelleğini kullanır.
- `application/surface/build-surface-review-park-geometry.js` dış park halkalarını birleştirip delikleri çıkarır; `build-surface-review-cell-geometry.js` grid hücresini aynı hassasiyetli clip adapter'ı üzerinden parka kırpar.
- Modüller servis öncesinde ana thread ve worker'da yüklenir; servis gövdeleri eksik modül halinde yedek davranış olarak korunur.

## Hassas yüzey geometri kırpma — 13 Ekim 2026

- `domain/surface/collect-surface-review-clip-points.js` temizlenmiş operand noktalarını toplar; `find-surface-review-clip-origin.js` tam metreli ortak UTM başlangıcını bulur ve `translate-surface-review-geometry.js` tüm ringleri aynı offsetle taşır.
- `adapters/surface/run-surface-review-polygon-operation.js` polygon-clipping erişimini sınırlar; `application/surface/clip-surface-review-geometry.js` temizleme, yerel frame, clipping, koordinatları geri yükleme ve mevcut sayısal hata mesajını orkestre eder.
- Ana-thread lazy loader ve yüzey worker'ı bu modülleri servis öncesi yükler; servis içi legacy algoritma yedek olarak kalır.

## Yüzey inceleme fingerprint — 13 Ekim 2026

- `domain/surface/select-surface-review-fingerprint-fields.js` yalnız sabitlenen sınır, kaynak metaverisi ve grid hücre alanlarını seçer; `serialize-surface-review-fingerprint-input.js` mevcut JSON gösterimini üretir.
- `adapters/surface/encode-surface-review-fingerprint-input.js` UTF-8 byte dönüşümünü, `digest-surface-review-fingerprint.js` Web Crypto SHA-256 çağrısını yürütür.
- `application/surface/build-surface-review-fingerprint.js` adımları birleştirip küçük harfli hex digest döndürür. Ana thread ve worker modülleri servis öncesi yükler; eski servis davranışı fallback olarak kalır.

## Park içi sampling grid geometrisi — 13 Ekim 2026

- domain/surface/measure-grid-point-distance.js dış halka ve deliklerde işaretli sınır mesafesini hesaplar; ind-grid-interior-point.js sınırlı best-first alt bölmeyle güvenli iç nokta seçer.
- domain/surface/build-grid-line-mask.js çizgileri metre tabanlı engel poligonlarına çevirir; clean-grid-geometry.js UTM koordinatlarını milimetreye yuvarlayıp çöken halkaları eler.
- dapters/surface/clip-grid-geometry.js polygon-clipping çağrılarını her adımda aynı hassasiyet temizliğiyle sarar. Worker bu modülleri lc-review.js öncesi yükler; legacy servis uygulaması uyumluluk yedeğidir.

## Yüzey inceleme önbelleği ve özet orkestrasyonu — 13 Ekim 2026

- `domain/surface/is-surface-review-cache-current.js` park, CRS, hücre ve feature kimliklerinin tamamı aynı değilse çözümleme cache'ini reddeder; `retype-cached-surface-review-parts.js` geometriyi yeniden kırpmadan yalnız raster kaynaklı sınıfı günceller.
- `adapters/surface/surface-review-cache.js` part, mask ve WGS84 dönüşümleri için WeakMap ömrünü yönetir; `project-surface-review-feature-geometry.js` MultiPolygon ve eski ring formatlarını aktif UTM CRS'ine taşır.
- `application/surface/build-surface-review-summary.js` çözülmüş parçaları mevcut alan uzlaştırıcısına bağlar. Ana thread ve worker modülleri servis öncesi yükler; oturum kimliği, geometri cache'i ve alan hesabı korunur. Kilitli regresyon dosyaları değiştirilmedi.
