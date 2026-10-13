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

On ikinci grupta kilitli `src/services/measure.js` reverse-geocode isteği, fotoğraf çözümleme adapter'ı, fotoğraf kanıt özeti, GPS buton durumu ve tür seçici olarak beş modüle ayrıldı. Türkiye için il alanı kuralı, fotoğraf object-URL temizliği ve eşikleri, GPS izin/watch/presence/wake-lock sırası, formdaki Türkçe kanonik tür değerleri ve kaydetme/park doğrulama kapıları korundu. Kilitli ölçüm regresyon testleri değiştirilmedi; yeni modül davranış testleri, statik yükleme ve çevrimdışı precache kayıtları eklendi.

On üçüncü grupta kilitli `src/services/park-registry.js` içindeki daha önce tanımlanmış beş scan modülü çalışan servis girişlerine bağlandı: algılama başlatma, proje ölçümleri/GPS odaklama, adım seçimi, proje adı önizleme ve iptal. Gecikmeli harita ölçü yenilemesi, odak sırası, kart kaydırma ve dönüş sekmesi korunup orijinal inline işlevler yedek bırakıldı. Kilitli park akış testleri değiştirilmedi; modül delegasyonu ve çevrimdışı yükleme sırası için yeni regresyonlar eklendi.

On dördüncü grupta kilitli `src/services/measure.js` proje akışının son beş sorumluluğu ayrıldı: cihazda son proje tercihi, ölçüme proje açma orkestrasyonu, proje kartı, park bağlamı kutusu ve kanonik proje adı önizlemesi. Yetki/uygunluk kontrolleri, sahip/paylaşılan kart eylemleri, HTML kaçışlama ve şehir/ülke varsayılanları korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül testleri, yükleme ve PWA precache kayıtları eklendi.

On beşinci grupta aynı kilitli serviste proje dizini akışı beş sorumluluğa ayrıldı: sahip projeleri RLS sorgusu ve eski şema yedeği, paylaşılan collaborator park sorgusu, owner-first saf birleştirme, selector/kart sunumu ve yükleme orkestrasyonu. Park-scope filtresi, embed yedeği, son seçimi geri yükleme, boş durum, park kapısı ve yayın paneli senkron sırası korundu. Kilitli regresyon testleri değiştirilmedi; sorgu kontratı, görünüm, orkestrasyon, script sırası ve offline precache için yeni testler eklendi.

On altıncı grupta kilitli ölçüm servisindeki proje liste state'i için alan kapsamlı gözlemlenebilir store eklendi; `PROJ_LIST` uyumluluk görünümü olarak korunup store güncellemelerine bağlandı. Ayrıca proje create/update payload'ı, mevcut Supabase RLS yazma çağrısı, save use-case'i ve düzenleme formu beş modüle ayrıldı. Park zorunluluğu, insert/update alanları, toast/scan yönlendirmesi, edit iptali ve liste yenileme sırası korundu. Kilitli regresyon testleri değiştirilmedi; store, query, payload, hata/gate ve düzenleme akışlarına yeni testler eklendi.

On yedinci grupta aynı kilitli ölçüm servisindeki nokta akışından ziyaret edilmemiş waypoint okuma, son nokta okuma, yarış güvenli yeni nokta önerisi, en güncel nokta ölçümü okuma ve kaçışlamalı sonuç sunumu beş modüle ayrıldı. Proje filtreleri, GPS ile en yakın waypoint önceliği, ardışık numara yedeği, manuel giriş ve geç yanıt koruması ile en yeni kayıt sırası korundu. Kilitli ölçüm regresyonları değiştirilmedi; sorgu şekli, stale state, görünüm, script sırası ve çevrimdışı precache testleri eklendi.

On sekizinci grupta ölçüm fotoğrafı yaşam döngüsü kanonik dosya adı, tarayıcı JPEG sıkıştırması, çevrimiçi/çevrimdışı fotoğraf hazırlığı, Storage yükleme adaptörü ve Storage temizleme adaptörü olarak beş modüle ayrıldı. 1024 piksel sınırı, 0,7 JPEG kalitesi, object URL temizliği, kullanıcı kapsamlı Storage yolu, park konumu doğrulamasından sonra upload sırası ve çevrimdışı blob/dosya alanları korundu. Kilitli regresyon testleri değiştirilmedi; sıkıştırma, upload hatası, ham/decoded silme yolu ve yükleme sırası için testler eklendi.

On dokuzuncu grupta ölçüm düzenleme girişi beş modüle ayrıldı: primary-key kayıt okuma adaptörü, yeni/eski satır biçimlerini düzenleme alanlarına eşleyen domain modeli, form sunumu, düzenleme orkestrasyonu ve iptal sıfırlaması. Supabase sorgu kapsamı, çevre/DBH yedeği, tür doldurma sırası, yönlendirme ve proje değişikliği sırası, manuel nokta temizliği ve park kapısı korundu. Kilitli regresyonlar değiştirilmedi; adapter, domain, UI, orkestrasyon ve iptal davranışı için yeni testler eklendi.

Yirminci grupta ölçüm kaydetme girişinin çakışma koruması/use-case'i, bekleme düğmesi UI'sı, kilitli validator'a bağlı form doğrulaması, park/GPS/fotoğraf kapısı kararı ve ölçüm satırı payload'ı beş modüle ayrıldı. Kilitli validator ve karbon hesabı, kapı önceliği, hata bildirimi, yazma sütunları ve isteğe bağlı `park_id` davranışı korundu. Kilitli regresyon dosyaları değiştirilmedi; overlap, button restore, validation, gate priority ve schema uyumu için yeni testler eklendi.

Yirmi birinci grupta kayıt tamamlama ve kalıcılık beş modüle ayrıldı: çevrimiçi ölçüm insert/update adaptörü ve eski şema retry'si, GPS/ters-geocode alan eşlemesi, çevrimdışı kuyruk satırı hazırlığı, best-effort presence olayı ve çevrimiçi/çevrimdışı görünüm yenileme sırası. RLS primary-key update, park doğrulaması öncesi hiçbir yazma başlatmama, retry sırasında yalnız eski şema alanlarını kaldırma, çevrimdışı yeni client id/düzenleme işareti ve refresh sırası korundu. Kilitli regresyonlar değiştirilmedi; adapter, payload, presence ve completion sırası için yeni testler eklendi.

Yirmi ikinci grupta form hata odağı, yeni ağaç için alan temizliği, sayım içeren silme onayı, waypoint/proje silme RLS adaptörü ve silme orkestrasyonu beş modüle ayrıldı. Proje/tür seçimi ve formun ortak alanları silinmeden tutuldu; sayaç sorgusu, onay iptalinde yazmama, waypoint sonra proje silme ve başarılı işlemden sonra liste yenileme sırası korundu. Kilitli testler değiştirilmedi; UI, sorgu kontratı ve onay/iptal davranışı testleri eklendi.

Yirmi dördüncü grupta park proje yaşam döngüsünün kalan beş sınırı ayrıldı: seçili proje domain çözümlemesi, sekme başına tek park-tarama yönlendirmesi adapter'ı, proje park bağı sonrası ekran geçişi, proje değişim orkestrasyonu ve haritada çizilen parkı kaydetme akışı. Seçim ID eşleşmesi, presence/gate/nokta önerisi sırası, proje seçicilerinin güncellenmesi, çevrimdışı uyarı ve kayıt sonrası kart yenilemesi korundu. Kilitli regresyon testleri değiştirilmedi; beş modül için davranış ve yükleme/precache testleri eklendi.

Yirmi beşinci grupta park kimlikleri yönetim ekranı beş modüle ayrıldı: alan kapsamlı gözlemlenebilir UI state'i, proje park adı senkronizasyon adapter'ı, overview ve mevcut renderer'ı birleştiren sunum orkestrasyonu, değişiklik sonrası yönetim panellerini yenileme ve boş park filtresini state ile yönetme. Park/proje/ölçüm sorgu kapsamı, proje adı trigger'ına dayanan senkron, boş parkları koruma ve panel yenileme sırası değişmedi. Kilitli regresyon testleri değiştirilmedi; store, adapter, UI ve render state'i davranış testleri eklendi.

Yirmi altıncı grupta kilitli ölçüm servisinin GPS etkinleştirme akışı beş modüle ayrıldı: browser geolocation adapter'ı, GPS durum UI'sı, izin/timeout hata use-case'i, ekran wake-lock adapter'ı ve ilk fix/canlı izleme orkestrasyonu. iOS yardım metni ve 12 saniyelik bildirimi, `enableHighAccuracy`/15 saniye/timeout tekrar denemesi, izin reddi kopyası, fix sonrası ping/watch sırası ve GPS DOM gösterimi korundu. `test/gps-toast.test.mjs` dahil kilitli regresyonlar değiştirilmedi; yeni adapter, hata, UI, wake-lock ve start sırası testleri eklendi.

Yirmi yedinci grupta kilitli ölçüm servisinin fotoğraf kanıtı denetimi beş modüle ayrıldı: istek nesli state'i, canvas piksel adaptörü, denetim geri bildirimi, seçili dosya UI'sı ve doğrulama orkestrasyonu. Görsel dosya kapısı, kalite taraması/eşiği, bekleyen durum kopyası, eski asenkron sonuçların iptali ve object URL temizliği korundu. `test/photo-qa.test.mjs` dahil kilitli regresyon testleri değiştirilmedi; yeni akış, state, canvas ve UI testleri eklendi.

Yirmi sekizinci grupta kilitli ölçüm servisinin GPS görünüm güncellemesi beş modüle ayrıldı: doğruluk/koordinat sunum modeli, ayrıntı alanları UI'sı, harita işaretçisi adaptörü, aktif durum UI'sı ve yenileme orkestrasyonu. 10/20/40 m eşikleri, koordinat basamakları, rozet/kart biçimleri, harita popup'ı ve navigasyon ardından otomatik nokta önerisi sırası korundu. Kilitli GPS/regresyon testleri değiştirilmedi; format, UI, map-marker ve orkestrasyon sınırları için yeni testler eklendi.

Yirmi dokuzuncu grupta kilitli `lc-validate.js` kampanya kalıcılığı beş modüle ayrıldı: IndexedDB adapter, archive uygulama API'si, seri kayıt kuyruğu, bayat hata koruması ve owner/fingerprint ile eski cihaz taslağı seçimi. Ayrı `DendroGeoValidate` veritabanı, park filtresi, transaction tamamlanma semantiği ve mevcut global/fallback API korundu; örnekleme, spektral sınıflandırma ve Olofsson doğruluk hesabına dokunulmadı. Kilitli testler değiştirilmedi; adapter, use-case, yarış sırası, owner/fingerprint ve yükleme/precache sınır testleri eklendi.

Otuzuncu grupta kilitli yüzey inceleme UI'sinin fırça hücre seçimi, hücre kararı üretimi, sınırlı geri alma geçmişi, eski sürekli fırça maskesi göçü ve geometri bounds kapısı ayrıldı. Fırça yalnız park içine kırpılmış gerçek raster hücrelerine karar verir; kesişim eşiği, eski maske koruması ve darbeye bağlı undo sahipliği aynı kaldı. Kilitli regresyon testleri değiştirilmedi; yeni modül testleri ve lazy/precache yükleme kaydı eklendi.

Otuz birinci grupta kilitli LULC rapor sunumu sonuç DTO normalizasyonu, görünüm modeli, sınıf barları, QA/kaynak metadata'sı ve tek blok rapor birleştiricisi olarak beş modüle ayrıldı. Mevcut HTML bayt bazında karşılaştırıldı; sınıf sırası, %0,5 geometrik QA sınırı, kaynak dipnotu ve CSV/GeoJSON eylemleri korundu. Kilitli rapor regresyonları değiştirilmedi; lazy yükleme ve precache zinciri güncellendi.
