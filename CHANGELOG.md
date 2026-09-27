# Değişiklik Günlüğü (Changelog)

Bu dosya DendroGeo'nun sürüm geçmişini tutar.
Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) · Sürümleme: [SemVer](https://semver.org/lang/tr/)

Yeni sürüm yayımlama adımları: [`docs/surum-yayini.md`](docs/surum-yayini.md)

---

## [Yayımlanmadı]

### Düzeltildi — "bağla" UI'ları gerçekten çıktı + standart tema GERİ GELDİ (kabuk bozulmadan)
Kullanıcı (öfkeli, haklı): "parka bağlayı kaldır dedim duruyor; standart tema
yapmıştın geri bozmuşsun; sekme başlıkları (Waypoint/Plan) bozulmuş."
Teşhis: (1) "bağla" temizliği daha önceki bir pakette KAYBOLMUŞTU (commit
edilmemiş), kodda hâlâ duruyordu; (2) standart tema ile karşılaştırma kartı
çakışıyordu çünkü ui-standard'ın `.lead` kuralı, karşılaştırmanın
`dg-cmp-row lead` satırını 70ch'e daraltıyordu — iki istek aynı dosyada
çakıştığı için önceki turlarda biri düzeltilip diğeri bozuluyordu.
ÇÖZÜM (ikisi birlikte, kanıtlı):
- `dgScanLinkTarget`, `dgScanBindExisting`, "🔗 Bu parka bağla", "🔗 Bağla"
  select'i, "🌳 Parkı Algıla ve Bağla", "Proje oluştur / bağla" TÜMÜ silindi;
  yönetici yolu tek kapıdan: Yönetim → Park Kimlikleri (metinler "eşleştir"
  diline çevrildi).
- `ui-standard.css` kabuğa GERİ bağlandı ama style.css ile çakışan TÜM
  kurallar (.btn/.card/.alert/.badge/.lbl/.val/.lead/.tag + çıplak elemanlar)
  `.dg-page` (11 alt sayfa) kapsamına alındı; kabuğa yalnız çakışmasız
  `.view>h2` başlık ölçeği + yeni sınıflar girer. body'ler işaretli:
  kabuk `dg-app`, alt sayfalar `dg-page`.
- KANIT (hesaplanmış stil karşılaştırması): karşılaştırma kartı bugünkü
  canlıyla birebir (maxWidth none, 15px, mürekkep); sekme başlıkları standart
  dönemle birebir (23.2px Fraunces, #14532d). Ekran görüntüleri görsel olarak
  da doğrulandı.
KİLİTLER: ui-standard "kaza kilidi" (.lead/.badge/.btn/.card/.alert/.lbl/.val
global tanımlanamaz) + park-flow "bağla fonksiyonları GERİ GELMEMELİ".
577+ test yeşil · check ✅

### Düzeltildi — uzaktaki parka proje açılabilir + tüm CTA'lar canlı/tek aile (2026-09-27)
Kullanıcı: "uzaktaki bir parka proje oluşturamıyorum; proje oluşturabileyim,
sadece ölçüm giremeyim; GPS parkı algılasın… Hesapla ve Kaydet butonu da canlı
olsun, bütün butonlar aynı olsun."
- **Park Algılama kartına 🔍 ada göre arama** (`dgScanSearchByName`): önce
  kayıtlı parklarda `name_norm` arar, yoksa Nominatim koordinatı → `dgDetectAt`
  (aynı boru hattı). GPS artık yalnız ÖNERİ; uzaktaki parka **proje açılır**.
  ÖLÇÜM kapısı değişmedi: `saveMeas` konum çitiyle parkta olmayı zorunlu tutar
  (kartta yazılı olarak da belirtilir).
- **💾 Hesapla ve Kaydet CANLI:** 🌿/📡 ile birebir desen — `dgSaveBusy`:
  disabled + "⏳ Hesaplanıyor ve kaydediliyor…" + soluk + wait; `finally` ile
  her çıkış yolunda geri gelir.
- **CTA tek aile:** tam genişlik birincil butonlar (Kaydet, 🎯 Vardım, parola)
  `dg-png-btn primary`, ikincil `ghost`; eski `class="btn" style="width:100%"`
  deseni kabukta kalmadı.
Kilitler: critical-fixes +4 test. 576 test yeşil · check ✅

### Düzeltildi — Park Karşılaştırma kartı eski görünümünde + "kaldığın yerden devam"
Kullanıcı: "barları küçültüp en üsttekini kaydırmışsın, eski haline getir;
sayfayı yenilediğimde kaldığım yerden devam edebileyim."
- **ui-standard.css uygulama kabuğundan ÇIKARILDI** (yalnız 11 alt sayfada
  kalır): eleman seviyesi kurallar (h2/p/td/badge…) `.dg-cmp` barlarını ve
  lead satırını bozuyordu. KANIT: bozulma öncesi build (b6abd30) ile yeni
  build'in karşılaştırma kartı ekran görüntüleri **piksel özdeş** (md5 eşit).
- Kabuğun kullandığı tek sınıf (`.dg-sub`) `style.css`'e taşındı.
- `module-registry` kilidi güncellendi: `SUBPAGE_ONLY` istisnası + istisnanın
  kendisi kilitli (11 alt sayfa dosyayı GERÇEKTEN bağlıyor).
- **YENİ:** yenilemede son sekme + sekme içi kaydırma konumu geri gelir
  (`dg_last_view`, `dg_scroll_<sekme>`; tüm storage erişimleri try/catch,
  geçersiz sekme adında patlamaz; OAuth/recovery akışlarını etkilemez).
Kilitler: ui-standard "kabuğa sızmaz" + critical-fixes "kaldığın yerden devam"
(4 test). 572 test yeşil · check ✅

### Değişti — 📡 Konumu Etkinleştir artık CANLI buton (🌿 Yüzey Örtüsü Analizi ile birebir)
Kullanıcı: *"⏳ Analiz yapılıyor… gibi canlı buton yap; burayı incele ve buna
göre yap; saçma sapan farklı buton/tema/animasyon istemiyorum."*
- GPS kartı `dg-png-card` iskeletine geçti: `dg-png-head` + `dg-png-kicker`
  ("1 · SAHA KONUMU") + `dg-png-title` + `dg-png-sub` + canlı `dg-png-badge`
  (±m · ÇOK İYİ/İYİ/ORTA/ZAYIF) — yüzey analizi kartlarıyla aynı dil.
- Buton `class="dg-png-btn primary"` (LULC butonuyla aynı aile) ve aynı canlı
  desen: basınca `disabled` + "⏳ Konum alınıyor…" + opacity .65 + cursor wait;
  başarı/hata anında eski metnine döner (`dataset.oldText`). Yeni CSS/animasyon
  EKLENMEDİ (test kilidi: ui-standard.css'te @keyframes yok, .dg-png-btn ezilmez).

### Değişti — TEK tasarım sistemi: `css/ui-standard.css` (kullanıcı isteği)
İstek: *"📡 Konumu Etkinleştir butonunu canlı UI/UX'e göre yap (yüzey analizi
gibi); bütün sayfaların temaları, yazı stilleri, yazı renkleri, başlık/alt
başlık düzeni aynı olsun, bilimsel literatüre uygun; her sayfa/panel farklı
olmasın, butonlar aynı olsun."*

Ölçülen sorun: 11 alt sayfanın HER BİRİ kendi `<style>` bloğunda Arial gövde
yazısı, farklı yeşil (#14532d), farklı buton/başlık ölçüleri tanımlıyordu;
kabukta GPS butonu `.btn blue` + inline `width:100%` ile birincil CTA
ailesinden ayrışıyordu.

- **`css/ui-standard.css` (YENİ):** token anayasası (`--green:#1e6f4b`,
  Fraunces/Manrope/IBM Plex Mono), tipografi ölçeği (kicker/h1/h2/h3/h4/sub/
  meta), buton TEK aile (`.btn` + ghost/red/blue/amber/sm/lg/block), kart/
  alert/badge/tablo/form standartları. Her sayfada kendi stilinden SONRA
  yüklenir → aynı özgüllükte son kural kazanır; alt sayfaların Arial/dayatma
  stilleri eleman seviyesinde hizalanır (kendi sınıfları bozulmaz).
- **GPS bloğu** standart alan kartına geçti: `.card.dg-fieldcard` +
  `.dg-kicker` + `.dg-sub` + `.btn.block` (yüzey analizi kartlarıyla aynı dil).
- **11 alt sayfa** `../css/ui-standard.css` bağlar (kendi `</style>` sonrasında).
- `sw.js` r40: PRECACHE'e ui-standard.css eklendi (çevrimdışı alt sayfalar da
  standart görünür).
Kilitler: `test/ui-standard.test.mjs` (10 test). 567 test yeşil · check ✅

### Eklendi — konum doğrulaması + proje↔park kilidi (0007, kullanıcı isteği)
İstek: *"proje yapılacağı zaman veya projeye fotoğraf ekleneceği zaman konumdan
doğrulama alsın; aynı projeye farklı parklardan giriş yapılmasın; her proje park
ile eşitlensin; hatalı girişlerin önüne geçilsin."* İki katmanlı çit:

- **İstemci (`src/services/geofence.js`):** `dgFreshFix()` taze yüksek-hassasiyetli
  GPS (≤120 sn bayatlık, ±60 m hassasiyet eşiği); `dgGeoDecide()` saf karar —
  park poligonu içinde mi / kenara ≤40 m mi (GPS+OSM gürültü payı) / dışında mı.
  Proje açılışı (`dgScanCreateProject`) ve ölçüm+fotoğraf kaydı (`saveMeas`)
  doğrulanmadan BAŞLAMAZ; fotoğraf reddedilirse sunucuya hiç gitmez.
  Doğrulama damgası satırda: `geo_verified_at`, `geo_acc_m`, `geo_dist_m`.
- **Sunucu (`0007_geo_fence.sql`):** `trg_geo_fence` — istemci atlatılsa bile
  (elle API, eski sürüm, çevrimdışı kuyruk) park dışı ölçüm INSERT/UPDATE'i
  `23514` ile RED; tam poligon ray-casting (`dg_point_in_park`, jsonb),
  geometrisi olmayan miras parklar için alan-yarıçaplı daire yedeği.
  `trg_project_requires_park` — parksız yeni proje açılamaz ("her proje park
  ile eşitlensin"). Yönetici istisnası `geo_override_by` ile audit izi bırakarak
  mümkün; yetki sunucuda `is_admin()` ile yeniden denetlenir.
- **Geometri sunucuda:** tarama halkası `parks.geom_json`'a yazılır
  (`dgPersistParkGeom`, ≤500 nokta/halka) → çit daireyle değil poligonla karar
  verir; yazılamazsa sessizce daire yedine düşer (saha bloklanmaz).
- Eşikler tek yerde: `DG_GEO={ACC_MAX_M:60, MARGIN_M:40, FIX_MAX_AGE_S:120}`.
- Geriye uyum: mevcut satırlara dokunulmaz; parksız miras projeler çit dışında
  (onları `dgParkGate` + `trg_enforce_park_link` zaten kesiyor).

Kilitler: `test/geofence.test.mjs` (20 test) — poligon/margin/red/delik/hassasiyet/
miras-park kararları, halka sadeleştirme, saveMeas+proje+istisna kancaları,
index↔sw yükleme sırası, migration tetik/errcode/security-definer denetimi.

### Düzeltildi — "onayladığım kayıt haritada görünmüyor" (2026-09-26)
Kullanıcı bildirimi: *"son yüklenen veriyi onaylamama rağmen ne dünyada ne canlı
haritada göremiyorum."* Veritabanı tarafı sağlamdı — kayıt `status='Onaylı'`,
`shared=true`, RLS anon'a açık, REST aynı 12 satırı dönüyordu (canlı API'den
doğrulandı). Sorun istemcideydi; gerçek Chrome ile canlı sitede ölçülerek dört
ayrı kök neden kanıtlandı ve kapatıldı.

- **Çift işaretçi (Dünya sekmesi):** `addMarkersChunked` küme varsa
  TEMİZLEMEDEN ekliyordu. `loadWorld()` hem `startShell`'de hem her
  `approveMeas`'ta çalıştığı için küme 12 → 24 → 36 diye şişiyordu
  (ölçüldü: 2. `loadWorld` sonrası rozet "24", aynı nokta kümede 2 kez) ve
  tür/karbon analizi iki kez sayıyordu. Artık `clearLayers()` + çakışan
  turları iptal eden `_markerToken`. Ölçüm: 3 ardışık yükleme → 12/12/12, çift 0.
- **Canlı harita bir kez yükleniyordu:** `go("map")` içindeki
  `if(!liveLoaded){liveLoaded=true;loadLiveMap();}` kapısı yüzünden onaydan
  sonra sekmeye dönen yönetici eski kümeyi görüyordu; F5 şarttı. Yeni
  `DG_LIVE_DIRTY` bayrağı: onay/red/silme ve çevrimdışı senkronizasyon
  `dgMarkLiveDirty()` çağırır, sekme açılınca tazelenir (bayat değilse gereksiz
  sorgu atılmaz — ölçüldü: kirli 1 sorgu, temiz 0). Karta **↻ İşaretçileri
  tazele** düğmesi eklendi.
- **Sahte başarı mesajı:** `loadApprovedMarkers` sorgu `error`'ünü yok sayıyor,
  `catch` de yutuyordu → `done(0,[])` → ekranda YEŞİL *"✓ 0 onaylı kayıt
  yüklendi"*. `loadWorld()`'ün `catch(e){}`'sı ise her hatayı sessizce
  gömüyordu. Artık hata 3. argümanla taşınır (`n=-1`), kırmızı kutu + ↻ çizilir;
  `#worldErr` ve `#landingMapNote` ile Dünya/landing sekmeleri de açıklama basar.
- **Yanlış teşhis → veri kaybı riski:** `v_park_compare` 42501 (permission
  denied) döndüğünde `dgParkSchemaMissing` çağrılıyor, `DG_PARK_SCHEMA_OK=false`
  oluyor, ÖLÇÜM KAPISI kapanıyor ve yeni kayıtlar `park_id=null` yazılıyordu
  (`measure.js:278/318`). Yani geçici bir oturum/yetki hatası kalıcı veri
  bütünlüğü kaybına dönüşüyordu. Yeni `dgIsSchemaError()` yalnız gerçek şema
  hatalarını (42P01/42703/PGRST205) kabul eder; yetki/ağ hataları
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
