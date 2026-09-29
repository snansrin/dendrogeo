# Bilimsel rapor yayını — işletim rehberi

Bu belge **site içinden rapor yayınının** nasıl çalıştığını ve bir şey
takıldığında nereye bakılacağını anlatır. Raporun içeriği/biçimi için
`scripts/make-report.mjs` başındaki açıklama ve `rapor/DGR-…/index.html`
§4 (Yöntem) esas kaynaktır. Rapor kimliği: **DGR** = **DendroGeo Bilimsel Analiz Raporu** (iç/alan kimliği); dış kalıcı kimlik (DOI) atandığında §11 ve `metadata.json` üzerinden bağlanır (bkz. §6b).

## 1) Kısa yol (yönetici)

1. Uygulamada **🔐 Ölçüm Yönetimi** sekmesini aç.
2. **📄 Bilimsel Rapor Yayını** kartında parkı bul.
3. 🛰 kutusu işaretli kalsın (önerilir: §5–§6 arazi örtüsü sonuçları ve
   haritası da üretilir; üretimi birkaç dakika uzatır).
4. **📄 Yayınla**'ya bas → istek kuyruğa yazılır.
5. Bekle: kart 25 saniyede bir kendini tazeler. Rapor hazır olduğunda satırda
   **Yayınlandı** rozeti, `DGR-YYYY-NNNN` kimliği, **🔗 Aç**, **📤 Paylaş** ve
   **🗑 Geri çek** belirir. Sekmeyi/kapatmayı beklemene gerek yok — iş sunucuda
   sürer. Yanlışlıkla yayınlanan rapor aynı satırdaki 🗑 ile geri çekilir (§4b).

Bekleme süresi: GitHub zamanlayıcısı 5 dakikada bir çalışır; yoğun saatlerde
tetikleme 10–15 dakikayı bulabilir. Pages dağıtımı buna 1–2 dakika ekler.

## 1b) Kısa yol (kullanıcı — 0009)

Kullanıcılar **kendi park projelerinin** raporunu kendisi yayınlar
(2026-09-28, `0009_user_report_publish.sql`):

1. Uygulamada **📁 Projeler** sekmesini aç.
2. Parkı bağlı projenin satırındaki **📄** düğmesine bas → tablonun altında
   **Park Raporu** paneli açılır.
3. Panelde durum görünür: yayınlanmış rapor varsa **🔗 Aç** + **📤 Paylaş**;
   yoksa **📄 Yayınla**'ya bas → istek aynı kuyruğa (`report_requests`)
   yazılır, birkaç dakika içinde kalıcı bağlantı panelde belirir.
4. Bekleyen **kendi** isteğini **✖ Vazgeç** ile iptal edebilirsin.
5. Yayınlanmış raporu **🗑 Geri çek** ile yayından kaldırabilirsin — yönetici
   gibi: kendi projesinin bağlı olduğu park için (sunucu kilidi, §4b).

Sunucu kilitleri (RLS + `tg_report_request_gate`, iki katman):

| Kilit | Kural | Hata kodu |
|---|---|---|
| Kimlik | İstek yalnız kendi adına (`requested_by = auth.uid()`) | `REPORT_NOT_SELF` |
| Mülkiyet | Park, kullanıcının bir projesine bağlı olmalı | `REPORT_NOT_YOUR_PARK` |
| Kendi verisi | Kullanıcının o parkta en az bir **onaylı** ölçümü olmalı | `REPORT_NO_OWN_DATA` |
| Kota | Yönetici olmayan 24 saatte en fazla **3** istek açabilir | `REPORT_QUOTA` |
| 0008'den aynen | Park başına tek bekleyen istek + parkta onaylı veri şartı | `23505` / `REPORT_NO_DATA` |

Dürüstlük notu: rapor **park düzeyindedir** — yalnız isteyenin projesini değil,
parktaki tüm onaylı ölçümleri kapsar (panel bunu kullanıcıya da söyler).
Yönetici kartı ve hakları değişmez; Actions hattı aynı hattır (kimin istediğine
bakmaz, kuyruğu anon anahtarla okur).

## 2) Hat nasıl akar

```
📄 Yayınla (uygulama)
   └─> Supabase: report_requests  (status='Beklemede')          [0008]
          └─> rapor-yayin.yml (cron */5, concurrency kilitli)
                 └─> scripts/publish-queue.mjs   (anon anahtarla SALT OKUMA)
                        └─> scripts/make-report.mjs → publishPark()
                               ├─ rapor/DGR-YYYY-NNNN/{index.html,data.json,
                               │                       olcum.csv,park.geojson,harita.png}
                               ├─ rapor/index.html  (dizin)
                               └─ rapor/yayin-kuyrugu.json  (SONUÇ günlüğü)
                        └─> git commit + push (rebase + 3 deneme)
                               └─> GitHub Pages
   ┌──────────────────────────────────────────────────────────────┘
📄 Bilimsel Rapor Yayını kartı: durum + kalıcı bağlantı + 📤 Paylaş
```

**İstek veritabanında, sonuç repoda.** Yayın işinin Supabase'e *yazması*
`service_role` anahtarı gerektirir; o anahtar ne depoda ne tarayıcıda tutulur
(depoya giren süper anahtar, tüm RLS kurallarını anlamsızlaştırır). İş bu
yüzden salt-okunur **anon** anahtarla çalışır ve sonucu git'e yazar — commit
hem denetim izi hem yayın kanalıdır. İki tarafı birleştiren anahtar
`report_requests.id`'dir.

## 3) Durumlar ve anlamları

| Rozet | Anlamı | Ne yapılır |
|---|---|---|
| **Beklemede** | İstek kuyrukta, iş henüz almadı | Bekle; kart kendini tazeler. Vazgeçmek için ✖ |
| **Yayınlandı** | Rapor üretildi ve Pages'te | 🔗 Aç / 📤 Paylaş. Yeni çözümleme için **📄 Yeni sürüm** |
| **Başarısız** | Üretim hatası (günlükte nedeni yazılı) | Nedeni oku; 📄 Yayınla ile **yeni istek** aç (aynı istek yeniden denenmez) |
| **Vazgeçildi** | Yönetici isteği iptal etti | Gerekirse yeniden 📄 Yayınla |
| **Geri çekiliyor** | 🗑 isteği kuyrukta (report_retractions) | Bekle; iş birkaç dakikada tamamlar |
| **Geri çekildi** | Rapor yayından kaldırıldı, adresinde bildirim var | Yeni çözümleme için 📄 Yayınla (yeni DGR alır) |

Başarısızlığın en sık üç nedeni:
* **OSM/Overpass erişilemedi** → park poligonu çekilemedi. Birkaç dakika sonra
  yeni istek aç (🛰 kutusunu kapatıp denemek de poligon yükünü azaltmaz; poligon
  §5 konum çiti beyanı için de gerekir).
* **Planetary Computer/STAC yanıt vermedi** → arazi örtüsü (§5.2/§6)
  üretilemedi. 🛰 kutusunu kapatıp hızlı yayın al, tam sürümü sonra 📄 Yeni
  sürüm ile üret.
* **Raster/park alanı QA eşiği aşıldı** → sınır poligonu ile raster kapsama
  %0,5'ten fazla ayrışıyor. En sık neden: uygulamada elle çizilen poligonun
  **kendini kesen segmentler (düğüm)** içermesi — rapor §2/§7/§9'da düğüm
  sayısını beyan eder. Sınırı uygulamada yeniden çiz (veya OSM poligonuna
  dön) ve 📄 Yeni sürüm ile yeniden yayımla.
* **Onaylı ölçüm yok** → istek zaten veritabanında reddedilir
  (`REPORT_NO_DATA`); önce ölçümleri onayla.

## 4) Değişmezlik (immutability)

* Yayınlanmış bir rapor **değişmez**: `rapor/DGR-…/` içeriği dondurulmuştur,
  sayfa kendi SHA-256 içerik hash'ini açılışta yeniden hesaplayıp doğrular.
* Yeni çözümleme = **yeni kimlik** (sıra numarası artar), eskisi yerinde kalır.
  Bu yüzden kartta yayınlanmış park için düğme "📄 Yeni sürüm" der.
* Aynı isteğin iki kez işlenmesini iki şey engeller: workflow'taki
  `concurrency` kilidi ve günlükteki `request_id` (işlenmiş istek atlanır).
* **Geri çekme değişmezliği bozmaz:** rapor içeriği DÜZELTİLMEZ; yanlış
  yayın tümüyle kaldırılır ve yerine gerekçeli bildirim konur (§4b). Kimlik
  yeniden kullanılmaz, işlem günlüğe ve git geçmişine yazılır.

## 4b) Geri çekme (🗑 — 0010)

Yanlışlıkla yayımlanan rapor **sessizce silinmez, geri çekilir** (bilimsel
teamül: retraction). Akış yayınla aynı hattın tersidir:

```
🗑 Geri çek (yönetici: herhangi bir yayın · kullanıcı: kendi parkının yayını)
   └─> Supabase: report_retractions (status='Beklemede')        [0010]
          └─> rapor-yayin.yml (aynı 5 dk'lık iş) → publish-queue.mjs
                 ├─ rapor/DGR-…/{data.json,olcum.csv,park.geojson,
                 │               harita.png,metadata.json}  SİLİNİR
                 ├─ rapor/DGR-…/index.html → gerekçeli GERİ ÇEKME BİLDİRİMİ
                 │   (noindex; veri dosyalarına bağlantı YOK)
                 ├─ rapor/index.html → rapor listeden düşer
                 └─ günlük kaydı: status='Geri çekildi' (+gerekçe/tarih/kimlik)
```

Sunucu kilitleri (RLS + `tg_report_retraction_gate`, iki katman):

| Kilit | Kural | Hata kodu |
|---|---|---|
| Biçim | `report_id` yalnız `DGR-YYYY-NNNN` (yol enjeksiyonu yok) | `RETRACT_BAD_ID` |
| Kimlik | İstek yalnız kendi adına (`requested_by = auth.uid()`) | `RETRACT_NOT_SELF` |
| Aktiflik | Engelli hesap istek açamaz | `RETRACT_INACTIVE` |
| Mülkiyet | Yönetici olmayan yalnız **kendi projesinin parkı** için çekebilir | `RETRACT_NOT_YOUR_PARK` |
| Kota | Yönetici olmayan 24 saatte en fazla **3** geri çekme | `RETRACT_QUOTA` |
| Yineleme | Aynı rapor için ikinci bekleyen istek açılamaz (kısmi unique index) | `RETRACT_DUPLICATE` |

Ek dürüstlük katmanı: istemcinin beyan ettiği `park_id ↔ report_id` eşleşmesi
**repo günlüğüyle** doğrulanır — eşleşmeyen satır Actions tarafından İŞLENMEZ
(RLS park mülkiyetine bakabilir ama hangi raporun hangi parka ait olduğunu
yalnız günlük bilir). İstek satırları değiştirilemez (update politikası yok);
sonuç her zaman günlüktedir.

> Geri çekme, veriyi git **geçmişinden** silemez (geçmiş yeniden yazılmaz).
> Bildirim sayfası bunu açıkça söyler; kişisel veri (KVKK) bildiriminde
> depo sahibiyle iletişim yolu sayfada yazılıdır.

## 5) Kurulum (bir kez)

1. Supabase → SQL Editor → `supabase/migrations/0008_report_publish.sql` → Run.
2. Supabase → SQL Editor → `supabase/migrations/0009_user_report_publish.sql`
   → Run (kullanıcılar kendi parkını yayınlayabilsin: mülkiyet + kota kilidi).
3. Supabase → SQL Editor → `supabase/migrations/0010_report_retraction.sql`
   → Run (🗑 geri çekme kuyruğu: yönetici + kendi parkının sahibi).
4. Depoyu push'la: `rapor-yayin.yml` kendiliğinden etkinleşir.
   (GitHub → Actions → "Rapor Yayın Kuyruğu" → ilk koşuyu görmek istersen
   "Run workflow" da diyebilirsin; şart değil.)
5. Uygulamada 🔐 Ölçüm Yönetimi → kart parkları listeliyorsa hat hazır.
   (0010 uygulanmazsa site çökmez: 🗑 isteği sunucuda reddedilir ve arayüz
   "0010_report_retraction.sql çalıştırılmalı" der; yayın akışı etkilenmez.)

> GitHub, 60 gün boyunca **hiç** etkinlik olmayan depolarda zamanlanmış işleri
> devre dışı bırakır ve e-posta gönderir. Gelirse: Actions → "Rapor Yayın
> Kuyruğu" → Enable workflow.

## 5b) Yazar, QR ve arşiv boyutu (0012)

- **Yazar (0015 ile güncellendi)**: rapor, PARKIN VERİSİNİ ÖLÇEN kullanıcının
  adıyla yayımlanır. Öncelik zinciri: `dg_park_author(park)` (en çok onaylı
  katkısı olan kayıt sahibi · 0015) → `v_report_authors` (son yayın isteğini
  açan · 0012) → kurumsal "DendroGeo" (isim uydurulmaz). Kurucular (Nagihan Şirin,
  Sinan Şirin) künyede "Site kurucuları" satırında ve metadata'da
  `contributors` olarak beyan edilir; `creators` YALNIZ istek sahibidir.
  Ad çözülemezse (0012 SQL'i çalıştırılmamış / profil boş) yazar
  "DendroGeo (kurumsal)" olur — isim uydurulmaz. Kurulum: SQL Editor →
  `0012_report_author.sql` → Run.
- **QR**: künyedeki QR, raporun kalıcı adresini taşır (`data:` URI ile
  gömülü SVG → dış istek yok; basılı PDF'te de çalışır).
- **Arşiv boyutu**: `data.json`/`metadata.json` sıkıştırılmış (minified)
  yazılır; her yayının bayt büyüklüğü `rapor/yayin-kuyrugu.json` içinde
  `archive_bytes` alanıyla izlenir. Yayımlanmış raporlar DEĞİŞMEZ
  (dondurma ilkesi) — sıkıştırma yeni yayınlar için geçerlidir.

## 5c) Kendi kendini süren kuyruk (0016 · kalp atışı)

GitHub `schedule` pratikte güvenilmez (bu depoda '*/5' cron 20 saatte 4 kez
tetiklendi). 0016 ile kuyruk KENDİ KENDİNİ sürer:

0022 güncellemesi: GitHub, bir workflow'un GITHUB_TOKEN ile KENDİSİNİ
tetiklemesini sessizce düşürüyor (canlı kanıt: kalp dispatch'leri 202 aldı,
koşu oluşmadı). Bu yüzden zincir BAYRAK üzerinden döner: kalp → rapor-bayrak
→ kalp (iki bacak da "farklı workflow" = kanıtlı çalışan yol). Bayrak ~10 sn
sürer, checkout bile yapmaz; kalp son 4 dk'da koştuysa susar (mükerrer nabız
yok). Yedek bacaklar: kalp */5 + 6h cron, bayrak */5 cron, CI push tetiği.

```
┌────────────────────────────────────────────────────────────┐
│  rapor-kalp.yml (nabız, ~5 dk'da bir)                      │
│    1. HTTP: report_requests/report_retractions 'Beklemede' │
│       + rapor/yayin-kuyrugu.json (request_id eşleşmesi)    │
│    2. İş YOK  → hiçbir şey koşmaz (~15-20 sn)              │
│       İş VAR  → 'Rapor Yayın Kuyruğu' dispatch (kilitli    │
│                  concurrency → TEK üretici, çift DGR yok)  │
│    3. Zincir (0017): ANLIK repository_dispatch + BEKÇİ —   │
│       son 4 dk'da kalp koştuysa tetik atılmaz (tekilleşir),│
│       döngü zincirin devraldığını doğrular (if: always)    │
└────────────────────────────────────────────────────────────┘
   Yedekler: */5 cron · 6 saatlik re-arm cron · CI push tetiği (0013)
             · rapor-yayin kapanış zinciri · elle Run workflow
```

Bekleme üst sınırı fiilen ~4-6 dk; zincir koparsa en geç 6 saatte cron
yeniden armeler, her push anında canlandırır. 0017 notu: 0016'nın
'ertelenmiş dispatch' zinciri GitHub tarafında hiç koşmadı (gözlem: kalp
0 koşu) → anlık repository_dispatch'e geçildi (saniyeler içinde koştuğu
20:17 bot dispatch'iyle kanıtlı); ertelenmiş zamanlama KULLANILMIYOR.

## 5d) Park çalışma arkadaşı (0025)

Aynı parka birden çok kişi ölçü girebilir:
1. **Davet** — Ölçüm Yönetimi → 👥 *Park Çalışma Arkadaşları*: park seç,
   arkadaşının e-postasını yaz → `dg_invite_send` (yetki sunucuda: proje
   sahibi veya yönetici; kendine davet ve mükerrer ortak engelli).
2. **Kabul** — arkadaşın kendi hesabıyla giriş yapar → Projeler sekmesinde
   📬 *Park davetlerin* kartı → Kabul (`dg_invite_respond`; e-posta yalnız
   ADRESTİR, kabul `auth.uid()` ↔ profil e-postası eşleşmesi ister).
3. **Birlikte ölçüm** — paylaşılan parkın projeleri arkadaşın Ölçüm
   sekmesindeki listede 🌳 *ortak* rozetiyle görünür; kayıtlar HER ZAMANKİ
   gibi `owner = arkadaş` ile girer (kimin ölçtüğü bellidir), konum çiti
   (0007) ve park bağı kilidi (0006) aynen geçerlidir.
4. **Onay** — park sahibi, ortağın BEKLEYEN kayıtlarını Ölçüm Yönetimi
   ağacında görür ve onaylar (0025 `meas_select` genişletmesi); raporlar
   parkın TÜM onaylı kayıtlarını sayar, yazar = veri sahibi önceliği (0015).

**Yayınlama hakkı (0009 ile uyum):** raporu YALNIZ park sahibi (parkta kendi
projesi + kendi onaylı verisi olan) veya yönetici yayınlayabilir; ortak
kullanıcı yayın isteği açamaz (REPORT_NOT_YOUR_PARK). Park sahibi yayın
istediğinde rapor, parkın TÜM onaylı kayıtlarını (ortaklarınki dahil) sayar;
yazar künyesi veri sahibi önceliğiyle (0015) en çok katkısı olan kişidir.

Güvenlik: davet/ortak tablolarına istemciden YAZMA YOK (grant verilmedi) —
tüm yazımlar RPC denetiminde; davetler anon'a kapalı (rls-probe.sh 0025 bölümüyle denetlenir).

## 6) Envanter kalite kapıları (QA v2.1 · 0011)

Rapor motoru yayından ÖNCE kayıtları da denetler (§7 Çizelge 4):

| Kapı | Eşik | İhlalde |
|---|---|---|
| Tür sözlüğü eşleşmesi | kanonik ad / eşanlamlı | ⚠ beyan (ρ grup varsayılanı) |
| Fotoğraf kanıtı | her kayıtta `photo_url` | ⚠ beyan |
| GNSS doğruluk kaydı | `accuracy_m` dolu | ⚠ "kaydedilmedi" beyanı (±0,0 UYDURULMAZ) |
| Envanter tutarlılığı (h/D) | 15 ≤ 100·H/D ≤ 120 | ≥3 kayıt VE >%50 → **⛔ yayın bloğu** |
| Karbon yeniden hesabı | panel denklemi ±%20 (ve mutlak fark ≥5 kg — küçük kayıtlarda yuvarlama gürültüsü bayraklanmaz) | ≥3 kayıt VE >%50 → **⛔ yayın bloğu** |
| Park geometrisi | bbox/düğüm taraması | dikdörtgen `geom_json` yok sayılır → OSM'e düşülür (beyanla) |

Blok durumunda rapor §7 başlığında "GEÇİCİDİR … 0011 uygulanmadan
KULLANILMAMALIDIR" uyarısı basar. Göksu Parkı (park 25) için düzeltme
hazır: `supabase/migrations/0011_inventory_qa.sql` (çevre→DBH + ρ yeniden
hesap + gerçek OSM sınırı; idempotent, yedekli, geri almalı).

Yeni saha/cihaz verisi için elle panel girişi yerine:

```bash
node scripts/import-measurements.mjs saha.csv --park N --project N --owner UUID
#  · --birim auto (varsayılan): medyan h/D < 15 ise kolonu ÇEVRE sayar
#  · --dry-run: yalnız QA raporu  · --json: makine okur  · SQL idempotent
```

## 6) Elle yayın (yedek yol)

Kuyruk dışında tek park yayını hâlâ mümkün — aynı üreticiyi çağırır:

* Yerelden: `node scripts/make-report.mjs --park 5` (hızlı prova: `--skip-lulc`),
  sonra `rapor/` dizinini commit'le.
* GitHub arayüzünden: Actions → **Rapor Yayınla** (`rapor.yml`) → Run workflow
  → `park_id`.

Elle yayınlar `rapor/yayin-kuyrugu.json` günlüğünde görünmez (günlük yalnız
kuyruktan gelen istekleri ve bu hat kurulmadan önceki ilk yayını taşır);
`rapor/index.html` dizini ise her iki yolu da listeler.

## 6b) Rapor şablonu v2 (2026-09-28 · kullanıcı standardı)

Bu şablon **bu sürümden sonra üretilen** raporlarda geçerlidir. Yayımlanmış
`DGR-2026-0001` ve `DGR-2026-0002` dondurulmuştur ve eski şablonda kalır
(yayımlanmış rapor değiştirilmez; v2 çıktısı bir sonraki yayından, yani
`DGR-2026-0003`'ten itibaren görünür):

```
BELGE KÜNYESİ (kimlik · durum · konu · konum · tarih · analiz sürümü ·
               veri dönemi · çözünürlük · lisans · hash)
1 Analiz Özeti          8  Değerlendirme (yalnız betimleme)
2 Analiz Alanı          9  Sınırlılıklar
3 Veri Kaynakları      10  Tekrar Üretilebilirlik
4 Yöntem (4.1–4.5)     11  Analiz Parmak İzi (engine · commit · hash · DOI)
5 Nicel Sonuçlar       12  Rapor Geçmişi (sürüm zinciri)
  (Çizelge 1–3)        13  Atıf (önerilen atıf + BibTeX + DOI notu)
6 Harita (Şekil 2)     14  Kaynakça (DOI'lerle)
7 Kalite Kontrol       Ek A Veri Erişilebilirliği
  (Çizelge 4: QA/QC + alan dengesi sayıları)
```

İlkeler: **sonuç ile yorum ayrıdır** (§5 sayı verir, §8 yalnız veriden türeyen
betimleme yapar; normatif dil kullanılmaz); **QA/QC yıldızdır** (§7 kontrolleri
ve alan dengesi farkını sayılarıyla belgeler); **sertifika dili yoktur**
("onaylı rapor", "kesin sonuç", "%100 doğruluk", "resmî belge" gibi iddialar
yasak — şablon akreditasyon belgesi DEĞİLDİR ve bunu künyede söyler).

* **Şekil 1:** bar renkleri taksonomik grubu taşır — ibreli **yeşil**,
  yapraklı **turuncu**, diğer gri.
* **Şekil 2 (harita.png):** alt bilgi şeridi belge kimliğini (DGR-…), veri
  kaynağını, çözünürlüğü, projeksiyonu (EPSG), analiz tarihini, motor
  sürümünü ve © DendroGeo telifini taşır → harita tek başına dolaşıma girse
  bile kaynağı belirlidir. Ölçek çubuğu segmentli, harita alanı çerçevelidir.
* **metadata.json:** her raporun yanında DataCite Metadata Schema 4.7 alan
  adlarıyla hizalı makine okur üst veri (identifier/title/publicationYear/
  resourceType/version/spatialCoverage/temporalCoverage/resolution/
  methodVersion/sources/relatedIdentifiers/resultHash/gitCommit/doi). Sayfa
  başında aynı bilgiler JSON-LD (`schema.org/Report`) olarak da gömülüdür.
* **DOI hazırlığı:** DGR iç kimliktir; Zenodo/DataCite kaydı yapıldığında DOI
  §11'e, `metadata.json`'a (`doi` + `relatedIdentifiers`'a `IsIdenticalBy`)
  ve atıf bloğuna işlenir. Rapor kimliği DEĞİŞMEZ.
* **Sürüm:** her DGR `1.0` doğar. İçerik düzeltmesi = geri çekme + yeni DGR;
  aynı parkın yeni analizi = yeni DGR ve §12'de `IsNewVersionOf` zinciri.
* **Geometri QA:** elle çizilen sınır poligonlarında kendini kesen segment
  (düğüm) taraması yapılır; düğüm varsa §2/§7/§9 sayıyla beyan eder ve arazi
  örtüsü çözümlemesi yayınlanmaz (QA eşiği zaten bloklayacaktır; rapor
  NEDENİ de söyler).

Faz haritası (kullanıcı planı): **Faz 1** (rapor standardı) ve **Faz 2**
(dijital bütünlük: commit/engine/hash/geçmiş) bu sürümle TAMAM; **Faz 3**
(metadata.json + JSON-LD) TAMAM, QR kod ve gerçek **Faz 4** PID kaydı
(Zenodo API) bilinçli olarak SONRAYA bırakıldı (QR için satılabilir bir
kodlayıcı kararı gerekiyor; yanlış QR, hiç QR'dan kötüdür).

## 7) Bekçiler

`test/report-publish.test.mjs` şu sözleşmeleri kilitler: şema + RLS + trigger
(0008), workflow (cron/`contents: write`/concurrency/rebase, **secret yok**),
kuyruk planı (işlenmiş istek atlanır, limit), günlük bütünlüğü (kimlik biçimi,
hash'in yayınlanmış sayfayla eşleşmesi), arayüz bağlantısı (kart yalnız
`v-admin`, modül `index.html` + `sw.js CORE_ASSETS` kayıtlı, yeni CSS yok) ve
vm'de gerçek davranış (bağlantı yalnız geçerli `DGR-YYYY-NNNN` kimliğinden
kurulur → oynanmış günlük dosyası uygulama içine dış bağlantı sokamaz;
yönetici olmayan istek açamaz).

`test/retraction.test.mjs` geri çekme hattını (0010) kilitler: SQL kilitleri
(biçim/kimlik/mülkiyet/kota/yineleme + update politikası YOK), kuyruk planı
(günlükle park eşleşme doğrulaması, işlenmiş istek atlanır), dosya işleyici
(geçici dizinde: veri dosyaları silinir, bildirim yazılır, liste düşer, yol
enjeksiyonu reddedilir) ve vm'de istemci davranışı (🗑 düğmeleri, insert
gövdesi/oturum anahtarı, hata eşlemeleri, geri çekilen rapor bağlantı
üretmez).

`test/report-v2.test.mjs` rapor şablonu v2'yi kilitler: künye + 14 bölüm,
sonuç/yorum ayrımı, QA çizelgesi ve alan dengesi sayıları, grup renkli barlar,
parmak izi (engine/commit/hash/DOI "atanmadı"), tekrar üretilebilirlik,
geçmiş zinciri, atıf + kaynakça DOI'leri, metadata.json (DataCite deseni),
düğüm beyanı, PNG alt bilgi şeridi, sertifika dili yasağı ve yayımlanmış
dizinin tutarlılığı (kimlik↔park eşleşmesi, v2 sayfa ⇔ metadata.json,
günlükteki hash'in sayfada görünmesi).

`test/user-publish.test.mjs` kullanıcı yayını hattını (0009) kilitler:
mülkiyet + kendi onaylı verisi + 24 saatte 3 istek kotası + `requested_by =
auth.uid()` (SQL), 📁 Projeler'deki 📄 düğmesi ve panelin kablolaması
(arayüz), vm'de gerçek davranış (panel durumları, insert gövdesi/oturum
anahtarı, kota–mülkiyet hata eşlemeleri, başkasının isteğinde ✖ Vazgeç yok,
oynanmış günlük bağlantı sokamaz).
