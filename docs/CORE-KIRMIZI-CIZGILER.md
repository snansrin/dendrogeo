# DendroGeo ana çekirdek ve kırmızı çizgiler

## Ürün kararı

4 Ekim 2026 itibarıyla saha, yüzey analizi ve canlı harita sistemi DendroGeo'nun ana ürün çekirdeğidir. Bu sürüm, yeni geliştirmelerin davranış tabanıdır. Kurtarma dalı `recovery/core-2026-10-04`, kullanıcı onayıyla ana dalda çalışan çekirdeğe ilerletilmiştir.

11 Ekim 2026 itibarıyla ölçüm, park algılama, park analizi ve canlı haritanın main'deki dosyaları `docs/core-foundation-lock.json` içinde SHA-256 ile sabitlenmiştir. Kilitli dosyalar varsayılan olarak değişmez; kullanıcı açıkça kilitli servisin modülleştirilmesini istediğinde yalnız ilgili servis, davranış ve regresyon testleri korunarak değiştirilebilir. Her istisna önceki/yeni SHA-256 değerleriyle manifestte kayıtlı kalır. Entegrasyon için script yükleme listesi ve PWA precache gibi çevre dosyaları güncellenebilir.

| Referans | Değer |
|---|---|
| Ana çekirdek | `main` — `61d4163a0a6d9d62d6b5f4f623894a6c9b57e29a` |
| Aktif kurtarma dalı | `recovery/core-2026-10-04` — aynı commit |
| Önceki sabit kurtarma noktası | `recovery/previous-core-e7d9439` — `e7d94399aa6a058538068b6e4cc0263ed68ffa34` |
| Çekirdek davranış özeti | [Tek yüzey analiz motoru](ANALIZ-TEK-MOTOR-2026-10-04.md) |
| Kurtarma ve doğrulama | [Kurtarma kılavuzu](KURTARMA.md) |

## Kırmızı çizgiler

- `npm run check:core-foundation` değişmez dosyaların hash'lerini ve kilit manifestinin kendi hash'ini doğrular. Değişiklik CI'ı düşürür; kilit manifesti baseline `867c7566645b43cf7a5a7caf56bac6c44c39ef79` commit'idir.
- Eski `docs/surface-engine-lock.json` yalnız tarihsel yüzey motoru kaydıdır; güncel, daha geniş temel kilidi `docs/core-foundation-lock.json` dosyasıdır.

- Yüzey analizi ve canlı harita bu ürünün temel akışıdır. Bu bileşenler kullanıcı isteği dışında yeniden tasarlanmaz, kapatılmaz, kaldırılmaz veya davranışları değiştirilmez.
- Ham yüzey sınıfları ESA WorldCover 2021 v200 verisinden ve gerçek raster hücresi–park sınırı kesişimlerinden gelir. Alanı hedef yüzdeye uydurmayın; kaynak hücreleri, kabul edilmiş geometriyi veya yayınlanmış sonucu sessizce değiştirmeyin.
- Sentinel-2 taraması isteğe bağlı inceleme verisi sağlar; tarama tek başına sınıfları değiştirmez. Her yeni park/analiz taraması eşiklerde nötr 50 değerleriyle başlar. Kullanıcının hücre, fırça veya sınır kararı önceliklidir.
- Fırça, geçtiği raster hücrelerini tek tek sınıflandırır; yol/poligon çizimine dönüşmez. Ham raster ve kabul edilmiş sonuç, kullanıcı kararı olmadan değişmez.
- OSM yardımcı vektör verisidir; ham rasterın yerine geçmez ve yol çizgileri dolu yüzey poligonu sayılmaz. OSM hataları veya zaman aşımı yüzey analizi ve harita akışını kilitlememelidir.
- Canlı harita katmanları, waypoint ve navigasyon, ölçüm noktaları/fotoğrafları, canlı kullanıcı/ziyaretçi görünümü, fırça, görünürlük kontrolleri, doğrulanmış harita dışa aktarımı ve çevrimdışı ölçüm senkronizasyonu korunur. İzin, oturum koruması ve mevcut veri erişim kuralları gevşetilmez.
- Bilimsel alan/karbon hesapları, rapor anlık görüntüleri, kayıt kimlikleri ve DOI yayınları arayüz düzenlemesi sırasında etkilenmez. QA başarısızsa yayın kapısı aşılmaz.

## Geliştirme ve kabul ölçütü

Motor veya canlı haritayı etkileyen her iş ayrı bir dalda yapılır. Önce mevcut çekirdek commit'i ve geri dönüş yolu kayda alınır; değişiklik yalnız istenen kapsamda tutulur. İlgili regresyonlar, tam `npm run check`, CI, 360/390/430 px telefon görünümü ve canlı dosya sürümleri doğrulanmadan ana dala alınmaz. Yüzey motoru değişiklikleri en az Göksu Parkı, Başkent Millet Bahçesi ve Kuğulu Park verileriyle karşılaştırılır; sınıf alanları, QA farkı, fırça hücre kararları, geri alma, dışa aktarma ve kabul edilmiş sonuç kontrol edilir. Analiz verisi veya kaynak hatası varsa yöntem açıkça raporlanır; sonuçlar elle hedef değere zorlanmaz.

Saha çalışmasını durduracak bir arıza halinde önce düzeltme dalı değerlendirilir. Geri dönüş gerekirse etkin kurtarma commit'i ayrı worktree'de açılır; ana çalışma alanına `reset --hard`, force push, veritabanı geri yüklemesi veya yayın silme uygulanmaz.

### 12 Ekim 2026 — izinli test sınırı taşıması

Kullanıcının kilitli parçaları çalışır biçimde modüllere ayırma talimatıyla yalnız `test/critical-fixes.test.mjs` ve `test/park-invites.test.mjs` kaynak-konumu kontrolleri talep adapter/UI sınırlarına taşındı. Aynı sorgu/etiket şartları korunup servis delegasyonu eklendi. Önceki ve yeni hashler manifestte `authorized_modularizations` altında kayıtlıdır; manifest kendi hashine sabitlenmeye devam eder. Diğer temel dosya hashleri değiştirilmedi.

Kullanıcı yönetimi tablo ayrımında park-invites kompakt kullanıcı hücresi şartı gerçek UI modülüne taşınıp servis delegasyonu eklendi. Önceki/yeni test hashleri manifestte kayıtlıdır; aynı izinli modülerleştirme kapsamındadır.

### 13 Ekim 2026 — açık kullanıcı talimatıyla kilitli servis modülerleştirmesi

Kullanıcı, kilitli servislerin çalışmaları bozulmadan beşli modüller halinde ayrılmasını ve her grubun `main`'e alınmasını istedi. İlk grupta kilitli `src/services/offline.js` içindeki istemci kimliği üretimi, ölçüm eşleştirmesi, IndexedDB promise adaptörleri, kuyruk deposu ve senkron rozet sunumu beş yeni modüle taşındı. Owner/oturum kapıları, Supabase erişimi, fotoğraf yükleme ve yazma sırası değiştirilmedi. Kilitli `test/offline-safety.test.mjs` ve diğer temel regresyon testleri değiştirilmedi. Önceki ve yeni servis hash'i `authorized_modularizations` kaydında bulunur; 267 dosyalık temel hash denetimi ve sabit baseline çalışmaya devam eder.

İkinci grupta kilitli `src/services/map.js` içindeki koordinat doğrulama, waypoint hedef seçimi, ölçüm popup'ı, chunk'lı işaretçi çizimi ve waypoint listesi sunumu beş yeni modüle taşındı. Marker idempotency/token iptali, GPS ve veri yazma kapıları değişmedi. Kilitli harita ve waypoint regresyonları çalıştırıldı, dosyalar değiştirilmedi; servis hash istisnası manifestte kayıtlıdır.

Üçüncü grupta aynı kilitli servisten waypoint seçimi, harita viewport işlemleri, saha yönlendirme metni, waypoint marker çizimi ve GPS yön katmanı beş modüle ayrıldı. Seçim/yeniden çizim sırası, 50 m ve GPS belirsizliği metin eşikleri, harita odaklama ve veri yazma sınırı korundu. Kilitli testler değiştirilmedi; yeni servis hash'i ayrı bir manifest istisnasıdır.

Dördüncü grupta kilitli `src/services/geofence.js` içindeki sınır mesafesi, saf park kararı, taze GPS adaptörü, audit damgası ve doğrulama akışı beş modüle ayrıldı. `ACC_MAX_M`, `MARGIN_M`, `FIX_MAX_AGE_S`, miras park daire yedeği, sensörsüz yumuşak devam, izin/zaman aşımı blokları ve sunucu çiti aynı kaldı. Kilitli `test/geofence.test.mjs` değiştirilmedi; yeni delegasyon testleri eklendi ve servis hash istisnası manifestte kaydedildi.

Beşinci grupta kilitli `src/services/park-query.js` içindeki detaylı kapsam akışı eşzamanlı istek paylaşımı, park sınırına bağlı eski geometri temizliği/sonuç kaydı, OSM eleman toplama, park sınırına kırpma ve su katmanı çizimi olarak beş modüle ayrıldı. Aynı sınırda tek ağ isteği, geç gelen yanıtı reddetme, kapsam kutusu payı ve geometri filtreleri korundu. Kilitli park-ağ testleri değiştirilmedi; servis hash istisnası manifestte kayıtlıdır.

Altıncı grupta kilitli `src/services/osm-client.js` önbellek anahtarı, aynı sorguda bekleyen istek birleştirme, sağlıklı ayna seçimi, park/detay zaman bütçeleri ve ayna sağlık-karantina kaydı olarak beş modüle ayrıldı. Retry sırası, 30/60 saniye karantina, yanıt önbelleği ve hata şekilleri korundu. Kilitli ağ ve bütçe testleri değiştirilmedi; servis hash istisnası manifestte kayıtlıdır.

Yedinci grupta kilitli `src/services/lc-geo.js` sınır kutuları, UTM projeksiyonu, dikdörtgen ve dışbükey kırpma, izdüşürülmüş alan/kesişim olarak beş modüle ayrıldı. `[enlem, boylam]` sırası, Snyder eşitlikleri, kırpma toleransları ve alan çıktıları kilitli land-cover regresyonlarıyla karşılaştırıldı. Tembel yükleme zincirine ve çevrimdışı precache’e modüller eklendi; kilitli testler değişmedi ve servis/yükleyici hashleri manifestte kaydedildi.

Sekizinci grupta kilitli `src/services/lc-validate.js` deterministik örnekleme, Olofsson hata matrisi/metrikleri, spektral eşikler/tahmin, otomatik uzlaşma/kalite kapısı ve kampanya dışa aktarma/düzeltme olarak beş modüle ayrıldı. Örnekleme tohumları, eşikler, OA/kappa/alan belirsizliği, kampanya CSV/JSON biçimi ve insan düzeltmesi davranışı servis yedeğiyle karşılaştırıldı. Kilitli `test/lc-validate.test.mjs` değişmedi; lazy yükleme ve çevrimdışı precache güncellendi, servis/yükleyici hashleri manifestte kaydedildi.

Dokuzuncu grupta kilitli `src/services/lc-s2.js` sahne arama/seçimi, tarih pencereleri, varlığa özgü UTM raster penceresi, yansıma/spektral kanıt ve profil derleme olarak beş modüle ayrıldı. STAC GET isteği, sahne/tarih çeşitliliği, farklı EPSG bantlarında piksel eşlemesi, PB04 ofseti, medyan ve iki tarih gerektiren doğrulanmış ekstrem koşulları korundu. Kilitli Sentinel-2 testleri değiştirilmedi; lazy yükleme, çevrimdışı precache ve hash istisnaları güncellendi.

Onuncu grupta kilitli `src/services/lc-osm.js` OSM kanıtı/istek önbelleği, su halkası çıkarımı, su sınıfı düzeltmesi, yol etiketi politikası ve yola dayalı sert yüzey düzeltmesi olarak beş modüle ayrıldı. Tek istek paylaşımı, aynı park kapsamı ve on dakikalık önbellek, bağımsız su yedeği, yalnız izinli yüzey etiketli araç yollarının merkez-temas kanıtıyla sınıf değiştirmesi ve ham raster değerleri korundu. Kilitli land-cover/OSM testleri değişmedi; lazy/precache ve manifest hashleri güncellendi.

On birinci grupta kilitli `src/services/lc-stac.js` retry/iptal politikası, COG range adapter'ı, SAS varlık imzalama/cache'i, STAC karo/yıl/asset seçimi ve görüntü metadatası/park penceresi olarak beş modüle ayrıldı. GET+querystring ve `application/geo+json`, transient retry sınırı, tek zaman bütçesi, parent cancellation, Range başlıkları, içerik yanıtı ömrü, token kapsamı/sona ermesi ve yıl filtresi korundu. `test/critical-fixes.test.mjs` ve mevcut STAC/land-cover regresyonları değişmedi; yeni delegasyon testleri ile lazy/precache ve hash manifesti eklendi.
