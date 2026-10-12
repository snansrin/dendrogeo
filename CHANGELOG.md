Warning: truncated output (original token count: 34277)
Total output lines: 2006

# Değişiklik Günlüğü (Changelog)

Bu dosya DendroGeo'nun sürüm geçmişini tutar.
Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) · Sürümleme: [SemVer](https://semver.org/lang/tr/)

Yeni sürüm yayımlama adımları: [`docs/surum-yayini.md`](docs/surum-yayini.md)

---

## [Yayımlanmadı]

### İyileştirildi — Rapor haritası yüzey katmanları
Veri-yok tabanı, hücre/yüzey örtüsü, sınır dışı piksel temizliği ve ince çerçevenin çizim sırası ayrı modüle alındı; sınıf renkleri, çok halkalı kırpma ve mevcut PNG çıktısı korundu.

### İyileştirildi — Rapor haritası envanter noktaları
Envanter noktalarının harita çerçevesi içinde çizilmesi ayrı sunum modülüne alındı; sınırdaki noktaların görünmesi, halo/işaret renk sırası ve lejant/altbilgi üzerine taşmayı önleyen çerçeve denetimi korundu.

### İyileştirildi — Rapor haritası yüzey rasterizer'ı
Yüzey poligonlarını ve deliklerini PNG piksellerine boyayan even-odd rasterizer bağımsız modüle ayrıldı; rapor haritasının çizim sırası, görüntü davranışı ve mevcut API'si korundu.

### İyileştirildi — Rapor haritası çizim primitifleri
Halka dolgusu, sınır/halo çizgisi ve dairesel envanter noktası çizimi ayrı modüle taşındı; mevcut çizgi kalınlığı, nokta maskesi ve rapor haritası davranışı korundu.

### İyileştirildi — Rapor haritası koordinat projeksiyonu
Tuval boyutu, yerel metre ölçeği ve koordinatların X/Y piksel dönüşümü ayrı modüle alındı; çok halkalı park sınırı ve mevcut görünüm ölçüleri korunuyor.

### İyileştirildi — Rapor haritası sınıf lejantı
PNG sınıf takma adları ve lejant satır sırası ayrı sunum modülüne alındı; havuzun yalnızca haritada suyla birleştirilmesi ve maskeli alan satırı koşulu korundu.

### İyileştirildi — Rapor haritası poligon kırpması
Sınıf piksellerinin çokgen ve delik sınırları dışına taşınca bağlam tonuna döndürülmesi ayrı raster modülüne alındı; çok halkalı sınırın mevcut tarama çizgisi davranışı korundu.

### İyileştirildi — Rapor haritası ölçek çubuğu ve kuzey oku
Metre ölçeği seçimi, dönüşümlü dört segmentli ölçek çubuğu ve kuzey oku ayrı kartografik sunum modülüne taşındı; mevcut piksel yerleşimi ve etiket davranışı korundu.

### İyileştirildi — Rapor haritası lejant çizimi
Sınır, envanter noktası, park dışı, maskeli alan ve sınıf örneklerinin lejant çizimi ayrı modüle taşındı; satır sırası, semboller, renkler, alan yuvarlaması ve metinler korundu.

### İyileştirildi — Rapor haritası altbilgi künyesi
Belge kimliği, marka, veri kaynağı, çözünürlük, projeksiyon ve analiz bilgisini çizen altbilgi ayrı modüle taşındı; dar haritalardaki punto uyarlaması ve eksik metadata varsayılanları korundu.

### İyileştirildi — Park geometrisi backfill modülü
Yönetim ekranındaki OSM sınırı backfill akışı uygulama use-case'ine taşındı; yetki, park bulunamaması, OSM hatası, yazım hatası ve başarılı yenileme sonuçları eski bildirimlerle korunuyor. OSM way/relation sınır çözümlemesi adapter'a ayrıldı ve uygulama/adapter için odaklı testler eklendi.

### İyileştirildi — Ölçüm park kapısı
Park şeması yedeği, kayıt düzenleme, proje/park bağı ve tek seferlik algılama yönlendirmesi kararları uygulama use-case'ine taşındı; mevcut uyarı kartları ve ölçüm düğmesi davranışı korundu.

### İyileştirildi — Park backfill araması
Eski projeler için 1500 m → 3500 m → ada göre OSM arama sırası uygulama modülüne, ada göre Overpass sorgusu ve geometrik aday sıralaması adapter'a taşındı. 2,1 saniyelik sorgu aralığı ve eski `dg*` çağrıları korundu.

### İyileştirildi — Park geri doldurma planı
Park bağı olmayan projeler için ölçüm merkezini hesaplama, OSM adayını arama ve uygulanabilir/eksik satırları planlama akışı uygulama modülüne taşındı. Yönetici/çevrimiçi kapıları, 2,1 saniyelik sorgu aralığı ve mevcut önizleme davranışı korunuyor.
Planı onayla-yaz akışı da ayrı uygulama modülüne alındı; sıralı park kaydı ve proje bağı yazımları, kısmi hataları saymaya devam ediyor.
OSM'de eşleşmeyen tek bir proje için elle park açma, onay ve bağlama akışı da uygulama modülüne ayrıldı; mevcut plan satırı yalnız bağlama başarılıysa güncelleniyor.

### İyileştirildi — Park kimliği yönetim listesinin yükleme akışı
Yönetici yetkisi ve park/proje/ölçüm verilerinin paralel yüklenmesi uygulama modülüne taşındı. Yönetim ekranı mevcut hata mesajlarını ve çizim akışını koruyor; yeni modül çevrimdışı önbelleğe ve test yükleme zincirine eklendi.

### Düzeltildi — FINAL saha ölçüm protokolü ve DBH gösterimi
Saha ham değişkeni yerden 1,30 m yükseklikte mezurayla ölçülen **göğüs çevresi C (cm)** olarak kilitlendi. Ham değer `girth_cm` alanında korunur; DBH çapı yalnız **D = C / π** ile türetilip `dbh_cm` alanına yazılır. Allometri, hacim, QA ve Monte Carlo yuvarlanmamış türetilmiş D ile çalışır. Arayüz, rapor tabloları ve okunabilir dışa aktarımlar DBH'yi **1 ondalık basamakla** gösterir (örn. 28,647889… → 28,6 cm). README, yöntem, rapor yayını, envanter/karbon sayfaları ve İngilizce yöntem metni aynı protokole hizalandı. Aşağıdaki 0031/0013 kayıtları tarihsel karar günlüğüdür; güncel yöntem otoritesi değildir.


### Düzeltildi — Tarama başlangıcı ve hücre fırçası
Park analizi her açıldığında ve her yeni Sentinel‑2 taramasında önceki spektral profil temizlenir, dört hassasiyet eşiği tarafsız %50 değerine döner. Yeni profil geldikten sonra eşikler kullanıcının ayarlamasına açılır; ham WorldCover sınıfları kendiliğinden değişmez. Fırça izi artık sürekli yüzey maskesi yazmaz: metrik fırça iziyle kesişen raster hücrelerine haritadaki sınıf seçimiyle aynı hücre kararı uygulanır. Son fırça izi önceki hücre kararlarını koruyarak geri alınabilir; eski sürekli fırça maskeleri hücre kararlarına çevrilir.

### Düzeltildi — Yüzey incelemesinde kapalı yol çizgilerinin alan sayılması
Kapalı bir OSM `highway` çizgisi, yalnızca ilk ve son koordinatı eşleşiyor diye artık dolu poligon kabul edilmiyor. Yolun alansal yüzey olarak değerlendirilmesi için `area=yes` veya `area:highway` gerekir; açık genişliği bulunan doğrusal yollar çizgi olarak tamponlanır. Eski türetilmiş OSM sınırları yeni kuralla yeniden oluşturulur; manuel düzeltmeler ve kabul edilmiş rapor anlık görüntüleri korunur.

### Eklendi — 0058: 🖼️ DOĞRULANMIŞ HARİTA PNG — kabul/düzeltme SONRASI infografik çıktı
**Kullanıcı isteği (birebir):** "iyileştirmeden sonra böyle bir çıktıyı
alalım yine harika duruyor" (X lansman infografiğini göstererek).

**NE:** 1409597'nin kabul hattının (surface_reviews + polygon-clipping +
revizyon kilidi) ÜSTÜNE tek düğme: "🖼️ Doğrulanmış Harita" (Veri ve ayarlar
→ GeoJSON/CSV yanı). En az bir karar (hücre düzeltmesi VEYA çizilen bina/
havuz maskesi) varsa tarayıcı içi canvas infografik PNG üretir:
· hücreler `dgSensEffective` rengiyle (kabul edilmiş anlık görüntü),
  düzeltilen hücreler koyu yeşil konturlu
· çizilen maskeler yarı saydam üstte, park sınırı siyah
· sağ sütun: park sahası, karar sayısı, `dgSensAreas()`'nin ALT HÜCRE
  doğrulanmış alanları (bina/havuz ayrımı dahil)
· durum damgası: ÖNİZLEME / KABUL EDİLMİŞ v<revizyon>
· alt bant künye: WorldCover + Sentinel-2 tarihi + kaynak parmak izi
  (ilk 8 hane) + CC BY-NC 4.0

**KIRMIZI ÇİZGİ:** raster salt okunur; tüm sayılar record/areas'tan gelir;
yayın hattı ve make-report bu modülü tanımaz.

**Bekçiler:** test/lc-validate.test.mjs +4 (düğme/üretici/künye/kırmızı
çizgi/i18n). sw r67→r68. i18n +5.


### Düzeltildi — 0056: MOD AYRIMI — analiz etkinken park algılama TAMAMEN duraklatılır + tarama sonrası otomatik uydu altlığı
**Kullanıcı bildirimi (birebir):** "AYNI HALA PARK ALGILAMA YAPIYOR BEN
KABUL EDEMİYORUM Kİ GRİDLERİ ... GÜNCEL HARİTA DEDİM GELİŞMİŞ ALGILAMA
DEDİM ... DAHA PARK ALGILAMA İLE ANALİZİ AYIRAMIYOSUN"

**KÖK NEDEN (0055 neden yetmedi):** stopPropagation yalnız ADAY
poligonlarının tıklamasını koruyordu; oysa kullanıcının bastığı yeşil
gridler LULC rapor poligonlarıydı (dgLcRenderObjects, interactive:false) —
üstlerine tıklama DOĞRUDAN haritaya düşer, PARK_MODE açıksa dgDetectAt
çalışır, drawPark paneli söker. Olay yamasıyla çözülemez: modların
AYRIŞMASI gerekir.

**ÇÖZÜM — bekçi bayrağı (yapısal):**
* Panel mount olduğu anda `window._dgSensGuard=true`; bindParkClick ilk
  satırda guard'a bakıp ÇIKAR → panel etkinken haritanın NERESİNE
  tıklanırsa tıklansın park algılama çalışmaz (LULC gridi, boş alan, aday).
* Başlıkta mod çipi + iki düğme: 🛰 Analiz (guard açık, varsayılan) ·
  🌳 Park seç (guard'ı kullanıcı iradesiyle düşürür + PARK_MODE kapalıysa
  açar). cleanup/park değişimi guard'ı otomatik kapatır.
* TARAMA BİTİNCE altlık OTOMATİK uyduya geçer ("gözümle görüp takip
  edeyim" + "güncel harita dedim"): switchBaseLayer('sat'), durum
  DG_SENS.base'de izlenir, 🗺 Sokak düğmesiyle geri dönülür.

**Kırmızı çizgiler:** bindParkClick'in dgDetectAt yolu DEĞİŞMEDİ (yalnız
guard erken-çıkışı eklendi); "konumumdan algıla" ve geri doldurma aracı
guard'dan etkilenmez (onlar map click'i kullanmıyor). Park kimliği akışı,
motor, şema aynen.

**Bekçiler:** test/lc-validate.test.mjs +3 (guard zinciri: panel↔sens↔
cleanup, otomatik uydu altlığı, chip CSS). sw r65→r66. npm run check:
1141 test → 1141 pass / 0 fail.

### Düzeltildi — 0055: HÜCRE TIKLAMASI PARK ALGILAMAYI TETİKLİYORDU (olay kabarması)
**Kullanıcı bildirimi (birebir):** "yeşil gridleri seçerken sistem tekrardan
park algılama moduna geçiyor."

**KÖK NEDEN:** Leaflet'te interaktif vektör katmanına tıklama, DOM'da harita
kabına KABARIR (bubble). Park Analizi Modu açıksa (PARK_MODE — park
seçildikten sonra bilerek açık kalır ki başka parka tıklanabilsin)
bindParkClick aynı tıklamayı yakalayıp dgDetectAt → drawPark çalıştırıyordu:
panel sökülüyor (clearPark → DG_LC_SENS.cleanup), Overpass sorgusu atılıyor,
kullanıcının onay akışı yarıda kesiliyordu. 0053'teki workbench
poligonlarında da latent olan bu sınıf, 0054'te hücreler tıklanabilir
onay yüzeyine dönüşünce ortaya çıktı.

**ÇÖZÜM:** lc-sens polygon click handler'ı, katman olayının taşıdığı özgün
DOM olayında `L.DomEvent.stopPropagation` çağırır — popup açılır, harita
tıklaması YANMAZ. Leaflet'in kanonik katman/harita olay ayrımı deseni.

**Bekçi:** test/lc-validate.test.mjs — "0055 regresyon: hücre tıklaması
haritaya KABARMAZ" (handler desenini statik kilitler). sw r64→r65
(precache içeriği: lc-sens.js).

### Değiştirildi/Sadeleştirildi — 0054: 🛰 UYDU HASSASİYET PANELİ (workbench UI kaldırıldı · kaydırıcı + gözle onay + kalıcı kayıt)
**Kullanıcı geri bildirimi (birebir):** "yaptıkların çok teferruatlı, benim
istediğim daha basit: yüzey analizi butonuna basınca barlar çıkıyor ya —
bunlar gibi yatay bar koy; kaydırdığımda mesela sert zemin hassasiyeti
artsın ve harita üzerinde sert zeminleri işaretlesin, gözümle görüp takip
edeyim; doğru noktaları kabul ettiğimde kaydedip öylece kalsın. Daha
gelişmiş algılama, daha hassas ve GÜNCEL uydu verisi kullanarak. Az önce
yaptığını sil bence çok karışık olmuş — daha basit daha işlevsel olsun."

**KALDIRILDI:** 0053'ün üç adımlı Çalışma Sahası arayüzü
(ui/lc-workbench.js: A/B/C sekmeleri, örneklem turu, hata matrisi karnesi,
bottom-sheet etiketleme). Bilim çekirdeği (lc-validate.js metrik/örnekleme
fonksiyonları + lc-s2.js spektral motor) KORUNDU — testler duruyor,
kütüphane olarak hazır; yalnız KARMAŞIK UI gitti.

**EKLENDİ — ui/lc-sens.js (tek panel, sekmesiz):**
* Yüzey Örtüsü Analizi biter bitmez rapor barlarının HEMEN ALTINDA belirir
  (#lcSens kabı, park-export köprüsü otomatik mount — ayrı kart/düğme yok).
* 🔍 Tara: GÜNCEL sezon Sentinel-2 L2A (varsayılan 'latest' — kullanıcı
  isteği "en güncel uydu verisi") + aynı yılın ilkbahar/sonbahar kalıcılık
  pencereleri; profil IndexedDB'ye kaydedilir → sonraki açılışta TARAMASIZ,
  sahada çevrimdışı bile çalışır. Dönem seçici: Güncel / WorldCover 2021.
* Sınıf başına YATAY KAYDIRICI (0-100, varsayılan 50 = Göksu+park5 canlı
  kalibrasyonlu literatür tabanı, testle kilitli): eşikler taban etrafında
  doğrusal kayar (dgValThr; eğimler DG_VAL_SENS_K). Kaydırıcı yalnız
  ÖNBELLEKTEKİ profili yeniden sınıflar — ağ isteği YOK, anlık.
* Aday hücre (spektral ≠ raster, karar verilmemiş) haritada sınıf rengiyle
  kesikli kontur; onaylı hücre dolu renk; teyitli ince yeşil. Hücreye
  dokun → ✅ Kabul / ❌ Harita doğru / ↩ Geri al. Sınıf başına toplu
  "✓ Hepsini kabul" (confirm'li).
* Kararlar park başına KALICI (IndexedDB 'sens-<parkId>') + otomatik kayıt;
  "Onaylarınla" satırı düzeltilmiş ha + Δ'yı anlık gösterir
  (applyCorrections saf — raster groupAreas'e dokunmaz).
* 📥 GeoJSON (denetim izli onaylı hücreler) + 📥 CSV (kararlar + alanlar).

**BİLİMSEL DÜRÜSTLÜK (kırmızı çizgi aynen):** raster sonucu/rapor barları/
yayın hattı DEĞİŞMEZ; onaylar AYRI düzeltme katmanıdır (Olofsson harita+
saha-düzeltmesi ayrılığı). Varsayılan 50 kaydırıcısı 0053'teki kalibre
davranışı BİREBİR üretir (8 piksellik eşdeğerlik testi kilitler).

**DİĞER:** lc-s2 'latest' modda kalıcılık pencereleri de güncel yılı
kullanır; Windows yol düzeltmesi (check-csp.mjs + publish-queue.mjs:
URL.pathname → fileURLToPath — 'C:\C:\...' ENOENT kazası kökten bitti);
park paneli kart numaraları geri alındı (3·RAPOR PNG, 4·KATMANLAR);
css .dg-valw-* bloğu silindi, .dg-sens-* eklendi (animasyon YOK);
i18n += 33 anahtar; sw r63→r64 (precache: workbench çıktı, lc-sens girdi).

**Bekçiler:** test/lc-validate.test.mjs 70→79: hassasiyet eşdeğerlik +
kaydırıcı yön testleri (yeşil/su/sert/çıplak ↑↓), agreement sens geçişi,
lc-sens entegrasyon kilitleri (zincir/precache/lcSens kabı/mount köprüsü/
cleanup/ölü .dg-valw yasağı/i18n/kalıcılık sözleşmesi), kırmızı çizgi
bekçisi lc-sens'i de kapsar. npm run check: 1138 test → TÜMÜ YEŞİL.

### Eklendi — 0053: 🛰 DOĞRULAMA ÇALIŞMA SAHASI v5 (LULC accuracy assessment · Olofsson 2014 · Sentinel-2 çok zamanlı kanıt)
**Kullanıcı isteği:** "canlı haritanın analiz tarafını en gelişmiş seviyeye
çıkar; uydu görüntüsü ile sistemin işaretlediği su, sert zemin, yeşil alan
birebir uyuşana kadar geliştir; sahada telefonla çalıştığımızı unutma;
çalışan çekirdeğe zarar verme."

**MİMARİ — üç bağımsız kanıt hattı (sayısal sonuçları ÖLÇER, DEĞİŞTİRMEZ):**
* **A · Spektral (yeni `src/services/lc-s2.js`):** Planetary Computer
  Sentinel-2 L2A → bulutsuz medyan kompozit (yaz: 6 sahne ☁≤%20) +
  MEVSİMSEL KALICILIK taraması (ilkbahar 3 + sonbahar 2 sahne, yıllık MAX
  MNDWI/NDVI) → hücre bazında NDVI/MNDWI/NDBI/IBI → otomatik uzlaşma +
  uyuşmazlık kuyruğu (kırmızı kontur). SCL bulut maskesi {2,4,5,6,7};
  EPSG disipline: her bant KENDİ UTM bölgesinde indekslenir (bölge sınırı
  parklarında kayma olmaz).
* **B · Görsel/insan (yeni `src/services/lc-validate.js` +
  `src/ui/lc-workbench.js`):** Olofsson vd. (2014) tabakalı ras…26277 tokens truncated…P01/42703/PGRST205) kabul eder; yetki/ağ hataları
  `dgParkCompareDenied()`'e gider ve şema bayrağına DOKUNMAZ. Yönetici artık
  zaten uygulanmış bir migration'ı yeniden çalıştırmaya yönlendirilmiyor.
- **"Null Island" tuzağı:** `Number.isFinite(+r.lat)` filtresi `+null === 0`
  olduğu için koordinatı NULL/boş gelen kaydı "geçerli" sayıp (0,0)a —
  Gine Körfezi'ne — çiziyor, küme sayısına gerçek ağaç gibi katıyordu. Yeni
  `dgValidCoord()` boş değeri, sınır dışını ve tam (0,0)ı reddeder; `world.js
  fitRows` (ülke/şehir yakınlaştırma) da aynı doğrulamayı kullanır.
- **Ölü kod:** `syncOfflineData()` içinde `updateSyncBadge()` çağrısı
  `return`'den SONRA yazılmıştı (hiç çalışmıyordu) → giriş yapılmamışken senkron
  rozeti takılı kalıyordu. Sıralama düzeltildi.

Kilitler: `test/map-refresh.test.mjs` (25 test) — çift işaretçi, token iptali,
hata iletimi, `DG_LIVE_DIRTY` kapısı, `dgIsSchemaError` sınıflandırması,
şema bayrağının düşmemesi, ölü kod ve koordinat doğrulaması. 531 test yeşil (+25).

### Değişti — ilk yükleme performansı (Faz 8)
Ölçüm (canlı site, gzip açık): sorun boyut değil **istek sayısı ve bloklama**ydı —
50 istek, 43 script'in tamamı `head`'de senkron, 10 dakikalık önbellek.

- **43 senkron script → hepsi `defer`**: HTML ayrıştırması artık script'leri
  beklemiyor, gövde hemen çiziliyor. `defer` belge sırasını koruduğu için modül
  zinciri ve `boot()` zamanlaması değişmedi.
- **LULC zinciri (8 modül) tembel**: `lazylibs.js → dgEnsureLulc()` yalnız
  "🌿 Yüzey Örtüsü Analizi"ne basıldığında sırayla enjekte ediyor
  (`async=false` → yürütme sırası korunur). `runLandCoverAnalysis()` artık
  `async` ve zinciri `await` ediyor; yüklenemezse sebep kullanıcıya gösteriliyor.
- **Google Fonts render'ı bloklamıyor**: `media="print"` + `onload="this.media='all'"`
  + `preload` + `<noscript>` yedeği.
- **8 ön bağlantı**: supabase.co (oturum sorgusu), challenges.cloudflare.com
  (Turnstile), fonts.gstatic.com, a/b/c.tile.openstreetmap.org,
  nominatim, overpass → DNS+TLS el sıkışması önceden.
- **Landing haritası tembel**: `IntersectionObserver` (rootMargin 400px) + 6 sn
  yedek; işaretçiler harita kurulunca yükleniyor (yarış bayrağıyla).

Sonuç: istek **50 → 42**, wire **277 → 250 KB**, blokluyan script **43 → 0**.
`sw.js` PRECACHE değişmedi → çevrimdışı davranış aynı.

### Eklendi
- `test/load-order.test.mjs`: tüm script etiketlerinin `defer` olduğu, LULC
  zincirinin index.html'de BULUNMADIĞI ama `DG_LULC_CHAIN`'de doğru sırada
  olduğu ve analiz köprüsünün zinciri beklediği kilitlendi.

## [3.0.0] — 2026-09-24

> 📦 **Zenodo:** [10.5281/zenodo.22948643](https://doi.org/10.5281/zenodo.22948643) ·
> GitHub Release `v3.0.0` (commit `56c7c4f`) · önceki sürüm:
> [10.5281/zenodo.22646300](https://doi.org/10.5281/zenodo.22646300) (v1.0.0)

Bu sürüm **iki büyük mimari değişiklik** içerir: ölçümler artık proje adına değil
**fiziksel park kimliğine** bağlanır ve giriş yöntemlerine **Google OAuth** eklenir.
Ayrıca veri tabanı şeması genişlediği (0004→0006) ve **lisans MIT'ten CC BY-NC 4.0'a
değiştirildiği** için SemVer gereği büyük sürüm artışı yapıldı.

> ℹ️ **Sürüm numaralandırması:** Bu sürümden itibaren proje **3.x** olarak
> numaralandırılıyor (proje sahibinin kararı, 2026-09-24). Daha önce arayüzde
> görünen `v11.0` dahili bir numaralandırmaydı ve hiçbir zaman GitHub
> Release/Zenodo sürümü olarak yayımlanmadı; bu yüzden `v3.0.0` ilk resmî
> etiketli sürümdür. Aşağıdaki `[11.0.0]` kaydı o dahili dönemi belgeler.
>
> ⚠ **Geriye dönük uyumsuz:** v11.x'ten yükseltirken `supabase/migrations/`
> altındaki 0002→0006 dosyaları sırayla çalıştırılmalıdır. 0004 uygulanmadan
> park kimliği devre dışı kalır (uygulama çökmez, proje adı bazlı yedeğe düşer
> ve ekranda uyarı gösterir).

### Eklendi

**Park kimliği mimarisi (0004–0006 + `src/services/park-registry.js`)**
- `public.parks` tablosu: fiziksel parkın **tek kimliği**. Canonical anahtar OSM
  elemanı (`way/123456`); OSM'de yoksa `manual/<ad>/<~100 m hücresi>`. UNIQUE
  kısıtı sayesinde aynı park iki kez kaydedilemez.
- `projects.park_id` + `label` + `park_name`; `measurements.park_id` (denormalize).
- `trg_compose_project_name`: proje adı **veritabanında** kurulur →
  `park adı - etiket` (örn. `Göksu Parkı - deneme`). İstemci kuralı unutsa veya
  bypass etse bile ad bozulamaz.
- `trg_enforce_park_link`: park bağı olmayan projeye ölçüm INSERT edilemez
  (`PARK_REQUIRED`, SQLSTATE `DG0PK`). UPDATE'te proje değişmiyorsa denetlemez —
  eski kayıtların onay akışı kilitlenmez.
- `trg_enforce_park_admin` (0006): mevcut bir projenin park bağını yalnız
  `is_admin()` değiştirebilir (`PARK_ADMIN_ONLY`). Yeni proje açmak için park
  algılamak herkese açık (saha akışı kilitlenmesin).
- `v_park_compare` view'ı: karşılaştırma artık **sunucuda** park bazında
  `group by` yapıyor → istemcideki `.limit(5000)` kesilmesi bitti; katkıda
  bulunan kişi sayısı, proje sayısı, tür sayısı, alan ve **t/ha** yoğunluğu geliyor.
- Ölçüm kapısı: parkı olmayan proje seçiliyken `Yeni Ölçüm` sekmesi kullanıcıyı
  doğrudan **park algılama ekranına** yönlendirir (proje başına bir kez; kapan
  döngüsü olmasın diye) ve kayıt düğmesi kilitlenir.
- Park algılama kartı: adım adım akış (parkı bul → kimliği doğrula → proje),
  "📍 Konumumdan algıla", OSM'de park yoksa **elle park oluşturma**.
- Kimlik birleşmesi: aynı ad + yakın konum → farklı OSM kimliği bile olsa TEK
  park. Yarıçap `sqrt(alan)` (50 ha park ~707 m) — canlıda yaşanan çift kimlik
  vakasından sonra 250→400 m taban ve `sqrt/2`→`sqrt` olarak düzeltildi.
- Yönetim aracı **🌳 Parkları Geri Doldur**: park bağı olmayan eski projeleri
  ölçüm merkezinden eşleştirir. Üç kademeli arama (1500 m → 3500 m → ada göre
  Overpass), canlı ilerleme çubuğu, önce **önizleme** sonra onay, eşleşmeyen
  satırlar için **✍️ elle park oluştur ve bağla**.
- Yönetim aracı **🌳 Park Kimlikleri**: çift kimlikleri ad+mesafe ile bulur,
  ✏️ yeniden adlandırır (`name_norm` da güncellenir), 🔀 birleştirir (projeler +
  ölçümler taşınır, adlar yeniden kurulur, kaynak kimlik silinir), 🗑️ siler
  (bağ kopar, veri silinmez). Otomatik birleştirme **bilerek yok**: aynı adlı iki
  ayrı park olabilir, karar yöneticide.

**Onay ve moderasyon**
- **📋 Park → Proje → Kullanıcı ağacı** (`src/services/admin-tree.js`): tüm
  durumlar (onaylı + bekleyen + red) tek yerde, `<details>` ile kademeli açılır.
- 🔴 **Onay bekleyen rozetleri** dört seviyede: park, proje, kullanıcı ve yan
  menüdeki `🔐 Ölçüm Yönetimi` öğesi (sekme açılmasa da yanar).
- "🔴 Sadece bekleyenler" filtresi ve "Bekleyenleri aç" kısayolu; sıralama onay
  kuyruğuna göre (bekleyen önce, sonra karbon azalan).
- Sorgu hatası artık **sessizce "Kayıt yok."a dönüşmüyor**: üç kademeli zincir
  (tam embed → gömüsüz çekip istemcide birleştir → hata kutusu + 🔄).
- Fotoğraf önizlemesi: moderasyon listesi, onay ağacı ve Kayıtlarım'da 40×40
  kapak görseli (`loading="lazy"`), tıklayınca yeni sekmede tam boy.

**Kimlik doğrulama**
- 🔵 **Google ile giriş** (Supabase OAuth). Logo satır içi SVG (dış kaynak yok),
  `prompt=select_account` (sahada ortak tablet), girişten sonra `?code=`
  temizlenir.
- `dgWaitForOAuthSession`: supabase-js URL'deki kodu arka planda takas ettiği
  için `boot()` takasın bitmesini bekler — beklemezse kullanıcı Google'dan
  başarıyla döndüğü hâlde landing'i görürdü.
- **KVKK açık rıza**: kayıt formunda onay kutusu (aydınlatma + gizlilik
  bağlantıları; konum, fotoğraf, kamuya açık veri seti ve yurt dışı
  barındırma açıkça sayılıyor). Rıza yoksa kayıt engellenir; rıza zaman
  damgasıyla auth metadata'sına yazılır (`kvkk_consent_at`).

**Yasal sayfalar ve uyum**
- `/gizlilik/` (12 bölüm), `/aydinlatma/` (KVKK m.10), `/kullanim-kosullari/`,
  `/kunye/` (künye + **içerik kaldırma süreci** + erişilebilirlik beyanı).
- **Harita atıfları**: 4 haritanın hiçbirinde atıf yoktu → `DG_ATTR` tek
  kaynağından ODbL/Esri/CC-BY-SA tam metinleri; PNG çıktısına telif satırı.
- **Lisans**: `LICENSE` MIT → **CC BY-NC 4.0** (kod + belge + veri birlikte);
  `NOTICE` eklendi (telif sahipleri, atıf biçimi, üçüncü taraf lisansları).
- **Kişisel e-posta kaldırıldı**: kurucunun gmail adresi 13 yerde geçiyordu →
  `sinan@dendrogeo.org`; migration'daki kurucu ataması placeholder'a çevrildi.
- JSON-LD: `Dataset` düğümü zenginleştirildi (gerçek kişi yaratıcılar,
  `isBasedOn` ile OSM/ESA atıfları, park kimliği değişkenleri), `sameAs`,
  `privacyPolicy`, `termsOfService`, `copyrightHolder`.
- `CITATION.cff` (Zenodo'nun okuduğu künye) ve bu `CHANGELOG.md`.

### Değişti
- Karşılaştırma sayfası **park bazlı**: `Park Karşılaştırma — Karbon
  Performansı` artık proje adlarını değil algılanan parkları listeliyor; aynı
  parktaki tüm kullanıcıların verisi tek satırda. Park bağı olmayan eski
  kayıtlar kaybolmuyor, "⚠ Park algılanmamış kayıtlar" bölümünde duruyor.
- Proje formu: serbest "Proje Adı" alanı kalktı → **park + etiket** ve canlı ad
  önizlemesi. Projeler tablosuna **Park** sütunu eklendi.
- Ölçüm Onay & Moderasyon **tek kartta**: hiyerarşik ağaç önde, düz liste
  katlanır `<details>` içinde.
- **Mobil düzen**: karşılaştırma satırları ve yönetim tabloları satır içi
  stilden sınıflara taşındı; ≤640px'te tablolar **kart düzenine** dönüyor
  (`data-label`), karbon barı alta iniyor, ağaç girintisi azalıyor.
- `projects_update` RLS politikası `is_admin()`'i de kapsıyor (geri doldurma
  aracı başkalarının projelerini de parka bağlayabiliyor).
- `v_park_compare` yalnız `authenticated`'a açık: view `security_invoker`
  olduğu için anon'a grant vermek `permission denied` üretiyordu.
- `arriveWp()` ölçüm formunu waypoint'in projesine geçiriyor (kapı doğru
  projeyi değerlendirsin).
- Grid/waypoint panelindeki proje listesi algılanan parkla sınırlandı.
- Service Worker `r35 → r37`; yeni modüller PRECACHE'te.

### Düzeltildi
- **PGRST201**: 0003 `measurements.reviewed_by` FK'sını eklediği için
  `measurements → profiles` arasında iki ilişki oluşmuştu; çıplak
  `profiles(full_name)` gömüsü "more than one relationship" hatası veriyor ve
  moderasyon tablosu sessizce "Kayıt yok." basıyordu → `profiles!measurements_owner_fkey`.
- **Asılı kalma**: `sb.from(...).order(...)` zinciri supabase-js'te geçersiz
  (`order` yalnız `select()` sonrası) → `TypeError` → onay ağacı sonsuza dek
  "⏳ Ölçümler yükleniyor…"da kalıyordu. Test sahtesi artık API biçimine sadık;
  repo genelinde canary eklendi.
- **Fazla `</div>`**: iki kart birleştirilirken kalan fazladan kapanış
  `v-users` bloğunu `#main` dışına itmişti → 👥 Kullanıcı Yönetimi bozuk
  görünüyordu. `test/ui-audit`'e yapısal denge kilitleri eklendi.
- **Türkçe büyük/küçük harf tuzakları**: `initcap('işçi')` → `Işçi` (yanlış)
  olduğu için `dg_tr_title()` elle eşleme kullanıyor (0005); `/isimsiz/i`
  deseni `İsimsiz`'i eşleştirmiyordu → uyarı hiç çıkmıyordu; `"İ".toLowerCase()`
  birleşen nokta ürettiği için park adı normalizasyonu elle çözülüyor.
- `parks_id_seq` USAGE grant'ı eksikti → `authenticated` rolü park kaydı

  eklerken `permission denied for sequence` alıyordu.
- Rıza kutusunda `consentEl.focus()` savunmacı çağrıya çevrildi.

### Altyapı
- **`.gitattributes`**: birinci taraf metin dosyaları **LF**'e sabitlendi
  (`vendor/` bilerek hariç — üçüncü taraf baytlarına dokunmuyoruz). Sebep:
  `manifest.json` CRLF ile commit edilmişti; yama Windows'a aktarılırken LF'ye
  döndüğü için `git am --3way` "patch does not apply / Did you hand edit your
  patch?" hatası veriyordu. `test/release.test.mjs` CRLF'in geri gelmesini
  ve vendor'ın değişmesini kilitliyor.

### Güvenlik
- `parks` RLS: okuma herkese (OSM türevi kamusal veri), yazma
  `created_by = auth.uid() and is_active()`, silme yalnız `is_admin()`.
- Park kaydı **upsert ile yapılmıyor**: upsert çakışmada UPDATE'e döner ve
  ikinci kullanıcı RLS'e takılırdı → select → insert → (yarışta 23505) yeniden
  select.
- Ölçüm kapısı hem istemcide hem sunucuda (`trg_enforce_park_link`).
- Parka bağlama yalnız yöneticide (istemci bekçileri + `trg_enforce_park_admin`).
- Fotoğraf adresleri `esc()` ile escape ediliyor (XSS kilidi testte).
- Depoda kişisel e-posta kalmadığını doğrulayan test (mutasyonla kanıtlandı).

### Test
- **450 → 503 test**. Yeni dosyalar: `test/park-identity.test.mjs` (kural +
  şema + kabuk kilitleri), `test/park-flow.test.mjs` (sahte Supabase/DOM ile
  uçtan uca akış, 13 bölüm), `test/admin-tree.test.mjs`,
  `test/google-auth.test.mjs`, `test/compliance.test.mjs` (hukuki uyum),
  `test/release.test.mjs` (sürüm tutarlılığı).
- Test sahtesi supabase-js API biçimine sadık hale getirildi (yanlış zincir
  sırası artık testi kırıyor); yürüyücülerin boş tarama yapıp sahte yeşil
  vermesi mutasyon testleriyle engellendi.
- Migration zinciri (0001→0006) yerel PostgreSQL 15 üzerinde Supabase
  stub'ları ve **gerçek rollerle** iki kez çalıştırıldı; RLS, trigger ve view
  davranışları doğrulandı.

---

## [11.0.0] — 2026-09-22 (dahili sürüm, etiketlenmedi)

Modüler mimariye geçiş ve performans fazları (ayrıntısı git geçmişinde):

- **Faz 1–3:** `index.html` inline script → `src/ui/{state,toast,landing,shell}.js`;
  landing stilleri `css/landing.css`'e ayrıldı; `index.html` artık
  `partials/{head,landing,shell,boot}.html`'den **üretilen artifakt**
  (`npm run build`, `build:check` ile CI'da kilitli).
- **Faz 4:** `gridplan.js` (3980 satır) yedi modüle bölündü (park zinciri:
  `park-state → osm-client → park-geometry → park-query → grid-engine →
  ui/park-panel → ui/park-export`).
- **Faz 5:** `landcover.js` (1779 satır) altı modül + ince facade oldu (LULC zinciri).
- **Faz 6:** `admin.js` beş modüle bölündü (yönetim zinciri).
- **Faz 7:** `geotiff` (317 KB) ve `chart.js` (208 KB) **tembel yükleme**ye geçti
  (`src/utils/lazylibs.js`) → landing açılışı ~525 KB hafifledi.
- Kritik düzeltmeler: STAC araması GET'e döndü (CORS preflight 405), ziyaret
  sayacı RLS-safe hale getirildi, `?v=` hash'leri içerikten türetilmeye başlandı
  (`version-sync.mjs`), Service Worker'da PRECACHE/RUNTIME ayrımı.
- Denetim: 0002 (e-posta gizliliği, waypoint sahip yetkisi, bileşik coğrafi
  indeksler) ve 0003 (denetim izi `reviewed_by/reviewed_at/reject_reason/deleted_at`,
  onay damgası trigger'ı, `v_world_agg` toplulaştırma view'ı).

---

## Sürüm öncesi kontrol listesi

```bash
npm run check        # sözdizimi + ?v= + build + CSP + 482 test
```

- [ ] `package.json`, `manifest.json`, `CITATION.cff`, `partials/head.html`
      (`softwareVersion`), `partials/landing.html`, `SECURITY.md`,
      `kunye/index.html` sürümleri **aynı** (`test/release.test.mjs` kilitler)
- [ ] `CHANGELOG.md` güncel
- [ ] Yeni migration varsa `supabase/README.md` + `dendrogeo-tam-kurulum.sql` güncel
- [ ] `sw.js` `CACHE_VERSION` artırıldı (modül kümesi değiştiyse)
- [ ] GitHub Release + Zenodo adımları: `docs/surum-yayini.md`

[3.0.0]: https://github.com/snansrin/dendrogeo/releases/tag/v3.0.0
[11.0.0]: https://github.com/snansrin/dendrogeo/releases/tag/v11.0.0
