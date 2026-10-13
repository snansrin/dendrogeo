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

Kullanıcı, kilitli servislerin çalışmaları bozulmadan beşli modüller halinde ayrılmasını ve her grubun `main`'e alınmasını istedi. İlk grupta kilitli `src/services/offline.js` içindeki istemci kimliği üretimi, ölçüm eşleştirmesi, IndexedDB promise adaptörleri, kuyruk deposu ve senkron rozet sunumu beş yeni modüle taşındı. Owner/oturum kapıları, Supabase erişimi, fotoğraf yükleme ve yazma sırası değiştirilmedi. Kilitli `test/offline-safety.test.mjs` ve diğer temel regresyon testleri değiştirilmedi. Önceki ve yeni servis hash'i `authorized_modularizations` kaydında bulunur; 267 dosyalık başlangıç kilidi, yeni kategori bağlantılarıyla birlikte ve sabit baseline üzerinden denetlenmeye devam eder.

46. grupta kilitli `src/ui/lc-sens.js` içindeki sağ tuş harita pan oturumu, sınır çizim sınıfı seçimi, fırça sınıfı seçimi, el moduna dönüş ve görünürlük opacity güncellemesi beş yeni modüle taşındı. Pointer capture/iptal akışı, çizim ve fırça kapıları, etkin fırçanın yeniden başlatılması ve 900 ms kaydetme debounce'u korundu. Kilitli regresyon testlerine dokunulmadı; önceki ve yeni kilitli giriş dosyası hashleri manifestte kayıtlıdır.

47. grupta aynı editörde tarama dönemi, spektral hassasiyet, sınıf odağı, aday görünürlüğü ve altlık haritası seçimi beş uygulama modülüne taşındı. Kayıt/ham görünüm/fırça/meşguliyet kapıları, 250 ms kaydırıcı debounce'u, `ytd` varsayılanı ve desteklenen üç altlık korundu. Raster ve geometri hesaplarına dokunulmadı; kilitli regresyon testleri değiştirilmedi.

48. grupta OSM nesne ayak izlerinin seçimi ve sınır önizleme yaşam döngüsü beş yeni modüle ayrıldı. Görünür nesne ve elle çizilmiş sınır sırası, ham görünüm ve düzenleme kapıları, eşleşen park OSM kaynağı kontrolü, harita tıklama oturumunun temizlenmesi, repartition-kaydet sırası ve yalnız başarılı taslak sonrası kabul akışı korundu. Kilitli regresyon testleri değiştirilmedi.

49. grupta yüzey düzenleme özeti ile ham, önizleme ve kabul edilmiş sonuç raporlarının sunumu beş modüle ayrıldı. Düzenleme sayımları, sınıf alan çubukları, mevcut rapor gövdesi ve ilk yüklemedeki ham rapor yedeği korundu; kabul edilmiş sonuç değiştirilemez snapshot’tan okunmaya devam eder. Kilitli regresyon testleri değiştirilmedi.

50. grupta yüzey harita katmanının render anahtarı ve eski async sonuç kapısı, Leaflet poligon üretimi, harita tıklama yönlendirmesi ve katman yenileme orkestrasyonu beş modüle taşındı. Epoch/geometry geçerliliği, nesne/fırça/çizim önceliği, sınıf odağı, opacity ve bitki katmanı davranışları korundu. Kilitli regresyon testleri değiştirilmedi.

51. grupta yüzey yeniden bölümlendirme isteği, epoch doğrulaması, başarılı geometri commit’i, geçici Leaflet katmanlarının temizlenmesi ve async orkestrasyonu beş modüle ayrıldı. Başarısız veya eski iş yeni feature/geometriyi commit etmez; fırça maskesi taşıması, hücre referanslarının kanonik diziye bağlanması ve mevcut busy/finally sırası korundu. Kilitli regresyon testleri değiştirilmedi.

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

Otuz ikinci grupta kilitli yüzey inceleme OSM nesne akışı doğrulanmış geometri araması, kayıt modeli, harita önizleme katmanı, seçim tıklaması ve taslak/uydu taraması/kabul orkestrasyonu olarak beş modüle ayrıldı. Küçük içeren poligon seçimi, park kırpması, hata/boş sonuç mesajları, önce cihaz taslağını kaydetme ve su hücresi taraması başarısızsa kabulü durdurma davranışları korundu. Kilitli regresyonlar değişmedi; nesne akışı ve yükleme/precache için yeni testler eklendi.

Otuz üçüncü grupta kilitli yüzey inceleme elle çizim akışı park noktası politikası, halka doğrulama/kırpma, geçici harita önizlemesi, çizim oturumu ve taslağı kaydedip su taramasını tamamlama olarak beş modüle ayrıldı. 300 köşe sınırı, koordinat sırası, 0,1 m² eşiği, mevcut feature alanları ve cihaz kaydı ardından su taraması sırası korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül ve yükleme/precache testleri eklendi.

Otuz dördüncü grupta kilitli yüzey inceleme hücre karar akışı popup modeli, popup sunumu, doğrulamalı tekli/toplu uygulama, tekil geri alma ve onaylı düzeltme sıfırlaması olarak beş modüle ayrıldı. Sınıf seçenek sırası, görsel hücre kayıt alanları, ham/meşgul/kaydetme kapıları, toplu işlemde hücre başına mevcut kayıt yolu, undo sırası ve ham raster korundu. Kilitli regresyon testleri değiştirilmedi; davranış ve yükleme/precache testleri eklendi.

Otuz beşinci grupta kilitli yüzey incelemenin spektral kanıt/NDVI sunumu tarama denetim modeli, açıklamalı görünüm, park içi tercil sınıflandırması, geometriye bağlı görünüm girdisi ve Leaflet poligon çizimi olarak beş modüle ayrıldı. Ham 2021 sınıfı karşılaştırması, kapsam sayaçları, üç gözlem şartı, eşit değerli tercil davranışı ve otomatik sınıf değiştirmeme kuralı korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül davranış ve lazy/precache testleri eklendi.

Otuz altıncı grupta kilitli yüzey kabul/kayıt akışı kabul kapısı, dondurulmuş taslak, alan korunumlu yayın snapshot’ı, eskime kontrollü hesap kaydı/yerel yedek ve kabul edilmiş sonuç görünümü olarak beş modüle ayrıldı. Park kimliği, görsel düzeltme provenance’ı, epoch ve kayıt nesnesi korumaları, hesap yazımı sonrası yerel cache, hata bildirimi ve kabul edilmiş rapor davranışı korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül testleri eklendi.

Otuz yedinci grupta kilitli yüzey fırçası pointer adaptörü, çizgi doğrulaması, hücre kararlarını uygulama/kaydetme, sahiplik kontrollü undo ve fırça ayarı olarak beş modüle ayrıldı. Pointer capture, harita drag/zoom geri yükleme, 300 nokta sınırı, metre tabanlı örnekleme aralığı, park nesli kapısı, görsel hücre provenance’ı ve kayıt sırası korundu. Kilitli regresyon testleri değiştirilmedi; modül ve mevcut fırça testleri çalıştırıldı.

Otuz sekizinci grupta kilitli yüzey düzenleyicinin ana paneli görünüm modeli, tarama/kanıt başlığı, hassasiyet kontrolleri, inceleme/kabul eylemleri ve sıralı panel birleştiricisi olarak beş modüle ayrıldı. Mevcut düğme/alan kimlikleri, sınıf ve tarih sıraları, ham görünüm metni, busy/disabled kapıları ve inline global eylemler korundu. Kilitli regresyon testleri değiştirilmedi; yeni görünüm bileşeni testleri eklendi.

Otuz dokuzuncu grupta kilitli ham/düzenleme görünümü geçişi izin kapısı, hazırlanmış geometri anlık görüntüsü, araçları kapatan state geçişi, park nesline bağlı cache geri yüklemesi ve orkestrasyon olarak beş modüle ayrıldı. Harita katman temizliği, aynı park geometrisini yeniden kullanma, yoğun durum temizliği, yeniden bölümlendirme yedeği ve özet yenileme sırası korundu. Kilitli regresyon testleri değiştirilmedi; ham görünüm ve geçiş modül testleri eklendi.

Kırkıncı grupta kilitli yüzey spektral tarama ve otomatik su katmanı beş modüle ayrıldı: OSM su/havuz adaptörü, rollback korumalı otomatik uygulama, tarama özeti, başarı finalize akışı ve scan use-case orkestrasyonu. OSM opt-out, park/epoch sahipliği, başarısız repartition rollback’i, nötr tarama başlangıcı, ham raster sınıfını değiştirmeme, hata kopyası, kayıt ve busy cleanup sırası korundu. Kilitli regresyon testleri değiştirilmedi; yeni akış testleri eklendi.


Kırk birinci grupta kilitli LULC dışa aktarma akışı beş modüle ayrıldı: GeoJSON/CSV veri üretimi, UTM canvas çerçevesi, erişilebilir katman seçici, harita katman çizimi ve doğrulanmış harita infografiği. Sınıf/alan sırası, NDVI provenance, BOM içeren CSV, park/grid/waypoint katman seçimi, önizleme/kabul etiketi ve WorldCover lisans dipnotu korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül sözleşme ve yükleme/precache testleri eklendi.


Kırk ikinci grupta kilitli LULC kayıt yükleme akışı beş modüle ayrıldı: varsayılan kayıt oluşturma, park kapsamlı cihaz taslağı ve parmak iziyle eski taslak göçü, hesap/cihaz kaynağı seçimi, kayıt alanı ve kabul snapshot doğrulaması, yükleme orkestrasyonu. Hesap snapshot’ının önceliği, yalnız daha yeni kirli cihaz taslağının seçilmesi, owner/park kapısı, duyarlılık sınırları, geçersiz kabul sonucunun gösterilmemesi ve mevcut hata mesajı korundu. Kilitli regresyon testleri değiştirilmedi; yeni akış ve precache testleri eklendi.


Kırk üçüncü grupta kilitli LULC su sınırı incelemesi beş modüle ayrıldı: açık/doğrulanmış su alanı politikası, dış su hücresi sınıflandırması, incelenecek hücre parçalarının seçimi, belirsiz hücrelerin tekilleştirilmiş sayımı ve yeniden tarama kapısı. Parka ait doğrulanmış OSM sınırı, elle sınıflandırmalar, spektral kanıt, en yakın grid komşusu ve eşitlik sırası korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül testleri eklendi.


Kırk dördüncü grupta kilitli LULC inceleme geometri ve alan akışı beş modüle ayrıldı: çözülmüş hücre parçalarının memo üretimi, alan özeti memo’su, düzeltilmiş özet modeli, worker tabanlı görünüm geometrisi ve park içine kırpılmış sınır GeoJSON’u. Memo kimliği/geçersizleştirme, kabul edilmiş geometriyi yeniden kullanma, worker yedeği, alan toplamları, sınır doğrulaması ve dışa aktarma alanları korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül testleri eklendi.


Kırk beşinci grupta kilitli LULC harita araç çubuğu beş modüle ayrıldı: araç durumu görünüm modeli, erişilebilir menü etiketi, panel başlığı, dosya/görünüm/sınır/veri/fırça menüleri ve araç rayı ile durum kabuğu. Menü ve kontrol kimlikleri, sınıf sırası, çeviri/kaçış, erişilebilir adlar, busy/raw/vejetasyon kapıları ve mevcut inline eylemler korundu. Kilitli regresyon testleri değiştirilmedi; yeni bileşen ve yükleme/precache testleri eklendi.
52. grupta kilitli `src/ui/lc-sens.js` içindeki park/veri parmak izi değişimi, eski kayda bağlı kararların sıfırlanması, oturumun hazırlanması, harita host’unun kurulması ve epoch kontrollü açılış tamamlaması beş modüle ayrıldı. Kabul edilmiş snapshot yalnız kaynak parmak izi değiştiğinde sıfırlanır; güncel epoch ve repartition başarılı olmadan sonuç gösterilmez. Kilitli regresyon testleri değiştirilmedi.
53. grupta kilitli `src/services/map.js` içindeki park bazlı Supabase Presence hata/yeniden deneme, ortak renk seçimi, kanal aboneliği ve JWT yenileme, kanal/katman temizliği ve 10 saniye sınırlı konum takibi beş modüle ayrıldı. Kanal aboneliği JWT yenilemesinden önce kalır; koordinatlar yalnız geçici `dg-park-<parkId>` kanalında paylaşılır. Kilitli regresyon testleri değiştirilmedi.
54. grupta kilitli `src/services/map.js` içindeki ortak Presence işaretçilerinin seçimi, görünüm modeli, Leaflet katmanının yeniden kullanımı, marker/tooltip çizimi ve çevrimiçi ortak sayısı beş modüle ayrıldı. Sıra, kendini gizleme, eksik koordinatların elenmesi, metin kaçışları ve mevcut marker/tooltip görünümü korunur.
55. grupta kilitli `src/services/map.js` waypoint CSV yüklemesi ayrıştırma, satır doğrulama, upsert komutu, Supabase adaptörü ve sıralı yükleme orkestrasyonu olarak beş modüle ayrıldı. BOM/başlık/boş satır davranışı, koordinat ve kimlik sınırları, owner/proje alanları, `project_id,wp_id` çatışma anahtarı, kısmi hata bildirimi ve liste yenileme sırası korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül testleri eklendi.

56. grupta kilitli `src/services/map.js` onaylı canlı harita yüklemesi koordinat politikasına göre satır seçimi, Supabase okuma adaptörü, marker yükleme use-case’i, durum sunumu ve canlı harita orkestrasyonu olarak beş modüle ayrıldı. `done(n, rows, error)` sözleşmesi, query/kesilme uyarısı, RLS hata görünürlüğü, marker sırası ve liveLoaded/dirty kapıları korundu. Kilitli regresyon testleri değiştirilmedi; yeni modül testi eklendi.

57. grupta ölçüm marker çizimi beş modüle ayrıldı: küme rozet modeli, marker/popup üretimi, küme veya düz katman hazırlığı, stale-token denetimli parça çizimi ve orkestrasyon. Mevcut küme seçenekleri, degrade uyarısı, katman temizleme, marker sırası, 16 ms zamanlayıcı ve yeni yüklemede eski turu iptal etme davranışı korundu; kilitli regresyon testleri değiştirilmedi.

58. grupta waypoint GPS overlay’i beş modüle ayrıldı: en yakın bekleyen hedef/rehberlik modeli, mevcut konum marker’ı, rehberlik metinleri ve ok göstergesi, kesikli harita çizgisi ve orkestrasyon. GPS marker’ının hedef seçiminden önce çizilmesi, başlangıçtaki hedef oku, mesafe/yön yuvarlaması, `_wp` temizleme işareti ve modül yoksa eski UI adapter fallback’i korundu; kilitli regresyon testleri değiştirilmedi.
