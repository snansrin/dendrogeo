# Bilimsel rapor yayını — işletim rehberi

Bu belge **site içinden rapor yayınının** nasıl çalıştığını ve bir şey
takıldığında nereye bakılacağını anlatır. Raporun içeriği/biçimi için
`scripts/make-report.mjs` başındaki açıklama ve `rapor/DGR-…/index.html`
§2 (Yöntem) esas kaynaktır.

## 1) Kısa yol (yönetici)

1. Uygulamada **🔐 Ölçüm Yönetimi** sekmesini aç.
2. **📄 Bilimsel Rapor Yayını** kartında parkı bul.
3. 🛰 kutusu işaretli kalsın (önerilir: §4 arazi örtüsü bağlamı da üretilir;
   üretimi birkaç dakika uzatır).
4. **📄 Yayınla**'ya bas → istek kuyruğa yazılır.
5. Bekle: kart 25 saniyede bir kendini tazeler. Rapor hazır olduğunda satırda
   **Yayınlandı** rozeti, `DGR-YYYY-NNNN` kimliği, **🔗 Aç** ve **📤 Paylaş**
   belirir. Sekmeyi/kapatmayı beklemene gerek yok — iş sunucuda sürer.

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

Başarısızlığın en sık üç nedeni:
* **OSM/Overpass erişilemedi** → park poligonu çekilemedi. Birkaç dakika sonra
  yeni istek aç (🛰 kutusunu kapatıp denemek de poligon yükünü azaltmaz; poligon
  §5 konum çiti beyanı için de gerekir).
* **Planetary Computer/STAC yanıt vermedi** → §4 üretilemedi. 🛰 kutusunu
  kapatıp hızlı yayın al, tam sürümü sonra 📄 Yeni sürüm ile üret.
* **Onaylı ölçüm yok** → istek zaten veritabanında reddedilir
  (`REPORT_NO_DATA`); önce ölçümleri onayla.

## 4) Değişmezlik (immutability)

* Yayınlanmış bir rapor **değişmez**: `rapor/DGR-…/` içeriği dondurulmuştur,
  sayfa kendi SHA-256 içerik hash'ini açılışta yeniden hesaplayıp doğrular.
* Yeni çözümleme = **yeni kimlik** (sıra numarası artar), eskisi yerinde kalır.
  Bu yüzden kartta yayınlanmış park için düğme "📄 Yeni sürüm" der.
* Aynı isteğin iki kez işlenmesini iki şey engeller: workflow'taki
  `concurrency` kilidi ve günlükteki `request_id` (işlenmiş istek atlanır).

## 5) Kurulum (bir kez)

1. Supabase → SQL Editor → `supabase/migrations/0008_report_publish.sql` → Run.
2. Supabase → SQL Editor → `supabase/migrations/0009_user_report_publish.sql`
   → Run (kullanıcılar kendi parkını yayınlayabilsin: mülkiyet + kota kilidi).
3. Depoyu push'la: `rapor-yayin.yml` kendiliğinden etkinleşir.
   (GitHub → Actions → "Rapor Yayın Kuyruğu" → ilk koşuyu görmek istersen
   "Run workflow" da diyebilirsin; şart değil.)
4. Uygulamada 🔐 Ölçüm Yönetimi → kart parkları listeliyorsa hat hazır.

> GitHub, 60 gün boyunca **hiç** etkinlik olmayan depolarda zamanlanmış işleri
> devre dışı bırakır ve e-posta gönderir. Gelirse: Actions → "Rapor Yayın
> Kuyruğu" → Enable workflow.

## 6) Elle yayın (yedek yol)

Kuyruk dışında tek park yayını hâlâ mümkün — aynı üreticiyi çağırır:

* Yerelden: `node scripts/make-report.mjs --park 5` (hızlı prova: `--skip-lulc`),
  sonra `rapor/` dizinini commit'le.
* GitHub arayüzünden: Actions → **Rapor Yayınla** (`rapor.yml`) → Run workflow
  → `park_id`.

Elle yayınlar `rapor/yayin-kuyrugu.json` günlüğünde görünmez (günlük yalnız
kuyruktan gelen istekleri ve bu hat kurulmadan önceki ilk yayını taşır);
`rapor/index.html` dizini ise her iki yolu da listeler.

## 7) Bekçiler

`test/report-publish.test.mjs` şu sözleşmeleri kilitler: şema + RLS + trigger
(0008), workflow (cron/`contents: write`/concurrency/rebase, **secret yok**),
kuyruk planı (işlenmiş istek atlanır, limit), günlük bütünlüğü (kimlik biçimi,
hash'in yayınlanmış sayfayla eşleşmesi), arayüz bağlantısı (kart yalnız
`v-admin`, modül `index.html` + `sw.js CORE_ASSETS` kayıtlı, yeni CSS yok) ve
vm'de gerçek davranış (bağlantı yalnız geçerli `DGR-YYYY-NNNN` kimliğinden
kurulur → oynanmış günlük dosyası uygulama içine dış bağlantı sokamaz;
yönetici olmayan istek açamaz).

`test/user-publish.test.mjs` kullanıcı yayını hattını (0009) kilitler:
mülkiyet + kendi onaylı verisi + 24 saatte 3 istek kotası + `requested_by =
auth.uid()` (SQL), 📁 Projeler'deki 📄 düğmesi ve panelin kablolaması
(arayüz), vm'de gerçek davranış (panel durumları, insert gövdesi/oturum
anahtarı, kota–mülkiyet hata eşlemeleri, başkasının isteğinde ✖ Vazgeç yok,
oynanmış günlük bağlantı sokamaz).
