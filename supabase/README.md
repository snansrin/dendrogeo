# supabase/ — veritabanı şeması, migration'lar ve güvenlik denetimi

Bu dizin projenin **gerçek şemasını** repoya taşır. Daha önce şema yalnızca
Supabase kontrol panelinde yaşıyordu; artık her değişiklik version control'da.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `migrations/0001_init_v2_1.sql` | Çalışır durumdaki TAM şema (kullanıcı tarafından sağlanan v2.1 + SECURITY PATCH v1). Idempotent. **Üzerine değişiklik yapılmaz.** |
| `migrations/0002_review_fixes.sql` | Kod incelemesinin 4 düzeltmesi (aşağıda). Idempotent. |
| `migrations/0003_audit_and_agg.sql` | Denetim izi (reviewed_by/at, reject_reason, deleted_at) + onay damgası trigger'ı + `v_world_agg` toplulaştırma view'ı. Idempotent. |
| `migrations/0006_park_admin_only.sql` | **Park bağı yalnız yöneticide**: `trg_enforce_park_admin` → mevcut projenin `park_id`'sini yalnız `is_admin()` değiştirebilir (`PARK_ADMIN_ONLY`, `DG0PA`). INSERT serbest (yeni proje açma saha akışı). Idempotent. |
| `migrations/0005_park_name_case.sql` | **Park adı yazım düzeni**: `dg_tr_title()` (Türkçe duyarlı: i→İ, ı→I) + yalnız tamamen küçük harfli adları düzelten tetikleyici + mevcut park/proje adlarının onarımı. Idempotent. |
| `migrations/0004_parks.sql` | **Park kimliği**: `parks` tablosu (OSM elemanı = canonical anahtar), `projects.park_id/label/park_name`, `measurements.park_id`, `v_park_compare` view'ı, iki trigger (proje adı kurma + ölçüm kapısı). Idempotent. |
| `migrations/0007_geo_fence.sql` | **Konum çiti**: `parks.geom_json`, `measurements.geo_verified_at/geo_dist_m/geo_acc_m/geo_override_by`, `dg_hav_m()` + `dg_point_in_park()` (ray-casting), `trg_geo_fence` (ölçüm parkın dışında ise INSERT/UPDATE reddi), `trg_project_requires_park`. Idempotent. |
| `migrations/0008_report_publish.sql` | **Site içinden rapor yayını**: `report_requests` kuyruğu (isteği yalnız `is_admin()` açar — 0009'da kendi parkı için kullanıcıya da açıldı; okuma anon'a açık — Actions işi buradan okur), aynı park için tek bekleyen istek (kısmi unique index), `tg_report_request_gate` (yetki + onaylı veri şartı; `REPORT_ADMIN_ONLY`/`REPORT_NO_DATA`). Idempotent. |
| `migrations/0009_user_report_publish.sql` | **Kullanıcılar kendi parkını yayınlar**: `tg_report_request_gate` genişletildi (yönetici olmayan için mülkiyet `REPORT_NOT_YOUR_PARK`, kendi onaylı verisi `REPORT_NO_OWN_DATA`, 24 saatte 3 istek kotası `REPORT_QUOTA`, `requested_by = auth.uid()` `REPORT_NOT_SELF`) + RLS insert/update: kullanıcı kendi bekleyen isteğini iptal edebilir. Idempotent, 0008'in üzerine. |
| `migrations/0010_report_retraction.sql` | **Geri çekme kuyruğu**: `report_retractions` (yönetici herhangi bir yayını, kullanıcı kendi parkının yayınını geri çeker; `report_id` biçim kilidi `RETRACT_BAD_ID`, kimlik `RETRACT_NOT_SELF`, mülkiyet `RETRACT_NOT_YOUR_PARK`, 24 saatte 3 `RETRACT_QUOTA`, yineleme `RETRACT_DUPLICATE`; select anon'a açık, update YOK, delete yalnız yönetici). Sonuç repo günlüğünde: Actions veri dosyalarını siler, adrese gerekçeli bildirim koyar. Idempotent, 0008+0009'un üzerine. |
| `dump-schema.sh` | Canlı şemayı `supabase db dump` ile yeniden dökmek için yardımcı |
| `audit/rls-probe.sh` | Anon key ile 13 saldırı denemesi (yetki yükseltme dahil) |
| `audit/RLS-DENETIM.md` | Denetim listesi + sonuç tablosu (doldurulacak) |

## Nasıl uygulanır

Supabase SQL Editor'da sırayla:

1. `0001_init_v2_1.sql` → Run (idempotent, tekrar tekrar güvenli)
2. `0002_review_fixes.sql` → Run
3. `0003_audit_and_agg.sql` → Run (denetim izi + toplulaştırma view'ı)
4. `0004_parks.sql` → Run (park kimliği + ölçüm kapısı + karşılaştırma view'ı)
5. `0005_park_name_case.sql` → Run (park adı yazım düzeni: "göksu parkı" → "Göksu Parkı")
6. `0006_park_admin_only.sql` → Run (park bağını yalnız yönetici değiştirsin)
7. `0007_geo_fence.sql` → Run (konum çiti: ölçüm park poligonu dışında ise sunucu reddeder)
8. `0008_report_publish.sql` → Run (site içinden rapor yayını kuyruğu)
9. `0009_user_report_publish.sql` → Run (kullanıcılar kendi parkının raporunu kendisi yayınlar: mülkiyet + kota kilidi)
10. `0010_report_retraction.sql` → Run (🗑 geri çekme: yanlışlıkla yayınlanan rapor yayından kaldırılabilir)
11. (Önerilir) `audit/rls-probe.sh`'i kendi makinenden çalıştır → sonuçları
   `audit/RLS-DENETIM.md` tablosuna işle

> ⚠️ **Sıra önemli:** `0004` uygulanmadan site çökmez ama park kimliği devre
> dışı kalır — istemci bunu algılar (`DG_PARK_SCHEMA_OK=false`), karşılaştırma
> proje adı bazlı yedeğe düşer, ölçüm kapısı kilitlenmez ve ekranda
> "0004_parks.sql çalıştırılmalı" uyarısı gösterilir.

## 0001'de doğru kurulu olanlar (inceleme onayı)

* Tüm tablolarda RLS açık; view'lar `security_invoker=true` (view'lar RLS'i
  atlamaz — Supabase'de en sık yapılan hata burada).
* `enforce_approval` trigger'ı: admin olmayan `status='Onaylı'` yapamaz
  (istemci koduna güvenmeyen, sunucu tarafı onay zorlaması).
* Storage izolasyonu: `(storage.foldername(name))[1] = auth.uid()::text` →
  herkes yalnız kendi klasörüne yükler, kendi/admin siler.
* `client_id` DEFAULT UUID + NOT NULL + UNIQUE → offline sync duplicate
  engeli istemci unutsa bile DB seviyesinde.
* `(project_id, point_id, measurement_no)` UNIQUE, mükerrer veri varsa
  DO bloğu ile zarifçe atlanır.
* `security definer` yardımcı fonksiyonlar `set search_path=public` ile
  (search_path enjeksiyonuna kapalı).
* İndeksler: owner/project/status/client_id/point + waypoints/project.

## 0002'nin kapattığı 4 boşluk

| # | Boşluk | Risk | Düzeltme |
|---|---|---|---|
| 1 | `profiles_update` yalnız `is_owner()` | Kullanıcı kendi adını/kurumunu düzenleyemiyordu | `id = auth.uid() or is_owner()` |
| 2 | `profiles_select using(true)` | Giriş yapmış herkes TÜM e-postaları okuyabiliyordu (KVKK) | `id = auth.uid() or is_admin()` |
| 3 | `wp_update/delete` yalnız satır sahibi | Proje sahibi kendi projesinin WP'lerini işaretleyip silemiyordu (`arriveWp` RLS'e takılırdı) | proje sahibi eklendi |
| 4 | Coğrafi sorguda tekil indeks | Canlı harita `status + lat/lon` aralığıyla sorguluyor | `(status, lat, lon)` + `(status, country, city)` bileşik indeks |

İstemci kodu denetlenerek doğrulandı: `profiles(full_name)` join'lerini yalnız
admin görünümleri kullanıyor (admin.js), dolayısıyla #2 daraltması uygulama
tarafında hiçbir şeyi kırmaz.

## Bilinçli olarak dokunulmayanlar

* `grant usage on all sequences to anon`: anon yalnız `site_visits`'e insert
  atar (ziyaret sayacı); identity dizisi için bu grant gerekli.
* `enforce_approval` + storage folder izolasyonu doğru kurulu.
* Denetim izi (`reviewed_by`, `reviewed_at`, `reject_reason`, `deleted_at`)
  istenirse **ayrı bir 0003** olarak eklenmeli (geri alınabilirlik).

## Kural

* Yeni şema değişikliği = yeni numaralı dosya; mevcut dosya düzenlenmez.
* Her migration idempotent yazılır (`if not exists` / `drop policy if exists`).
* Policy değişikliği sonrası `audit/rls-probe.sh` çalıştırılır.

## 0008 — site içinden bilimsel rapor yayını (2026-09-27)

Kullanıcı isteği: **"raporu site üstünden yayınlayacağım"** — GitHub Actions
arayüzüne gitmeden, uygulama içinden tek düğmeyle DGR kimlikli rapor yayını.

| Katman | Ne yapar |
|---|---|
| `report_requests` (bu dosya) | İSTEK: park kimliği, LULC tercihi, durumu (Beklemede/Vazgeçildi), kim-ne zaman |
| `src/services/report-publish.js` | 🔐 Ölçüm Yönetimi → "📄 Bilimsel Rapor Yayını" kartı: 📄 Yayınla / ✖ Vazgeç / 🔗 Aç / 📤 Paylaş + 25 sn'de bir kendiliğinden tazeleme |
| `.github/workflows/rapor-yayin.yml` | 5 dakikada bir kuyruğu okur → `scripts/publish-queue.mjs` |
| `scripts/publish-queue.mjs` → `make-report.mjs` | Raporu üretir, `rapor/DGR-YYYY-NNNN/` + `rapor/index.html` + `rapor/yayin-kuyrugu.json` yazar, commit/push |
| `rapor/yayin-kuyrugu.json` | SONUÇ: hangi istek → hangi DGR, hash, başarı/hata nedeni (Pages üzerinden herkese açık) |

**İstek veritabanında, sonuç repoda.** Actions'ın Supabase'e YAZMASI
`service_role` anahtarı gerektirir; o anahtar ne depoda ne tarayıcıda tutulur
(depoya giren süper anahtar = tüm RLS'in anlamsızlaşması). İş bu yüzden
salt-okunur **anon** anahtarla çalışır ve sonucu git'e yazar — git commit'i hem
denetim izi hem yayın kanalıdır. İki tarafı birleştiren anahtar
`report_requests.id`'dir.

Güvenlik notları:
* `select using (true)`: Actions anon anahtarla okuyabilmeli. Satırlarda kişisel
  veri yok (park kimliği + profil UUID'si + zaman damgası).
* `insert/update/delete` yalnız `is_admin()`; ayrıca `tg_report_request_gate`
  RLS atlatılsa bile yönetici olmayan isteği ve onaylı ölçümü olmayan parkı
  reddeder.
* Kısmi unique index: aynı park için aynı anda TEK bekleyen istek (çift tıklama
  iki rapor üretmez).
* Uygulama, günlüğün yazdığı bağlantıyı kullanmaz; bağlantı biçimi
  doğrulanmış rapor kimliğinden (`DGR-YYYY-NNNN`) kurulur
  (`test/report-publish.test.mjs` bunu kilitler).

> 0008 uygulanmazsa site çökmez: kart "0008_report_publish.sql çalıştırılmalı"
> uyarısını gösterir, diğer sekmeler etkilenmez.

## 0009 — kullanıcılar kendi parkını yayınlar (2026-09-28)

Kullanıcı isteği: **"kullanıcılar kendi park projelerini paylaşabilecek
değil mi?"** → doğrudan yayın: parkı için projesi olan kullanıcı, yayın
isteğini `report_requests` kuyruğuna **kendisi** yazar (📁 Projeler → 📄).
Hat değişmez: aynı kuyruk, aynı Actions işi, aynı DGR kimliği, aynı kalıcı
bağlantı. Yönetici hakkı aynen durur.

Kötüye kullanıma karşı sunucu kilitleri (RLS + `tg_report_request_gate`, iki
katman — istemci kapıları yalnız UX'tir):

* **Mülkiyet**: yönetici olmayan yalnız kendi projesinin bağlı olduğu park
  için istek açabilir (`REPORT_NOT_YOUR_PARK`, `DG0NP`).
* **Kendi verisi**: isteyenin o parkta en az bir **onaylı** ölçümü olmalı
  (`REPORT_NO_OWN_DATA`, `DG0ND`) — katkısı olmayan parkı yayınlayamaz.
* **Kota**: yönetici olmayan 24 saatte en fazla **3** istek (`REPORT_QUOTA`,
  `DG0QT`; iptal edilenler de sayılır → aç-kapat döngüsü kuyruğu yoramaz).
* **Kimlik**: `requested_by = auth.uid()` (`REPORT_NOT_SELF`, `DG0NS`) +
  RLS'te `is_active()` (engelli hesap istek açamaz).
* **İptal**: kullanıcı yalnız KENDİ bekleyen isteğini `Vazgeçildi` yapabilir;
  yöneticinin iptal hakkı değişmez. `select` (herkese) ve `delete` (yalnız
  yönetici) 0008'deki gibi kalır.
* 0008 kilitleri aynen: park başına TEK bekleyen istek (kısmi unique index),
  parkta onaylı veri şartı (`REPORT_NO_DATA`), `status` kümesi kapalı.

> 0009 uygulanmazsa kullanıcı 📄 düğmesine basınca sunucu reddeder ve panel
> "Yetki yok" uyarısı gösterir; yönetici kartı 0008 ile çalışmaya devam eder.
> Bekçi: `test/user-publish.test.mjs`.

## 0010 — geri çekme: yanlışlıkla yayınlanan rapor yayından kaldırılır (2026-09-28)

Kullanıcı isteği: **"yönetici kısmına yayınları silme yetkisi ver,
yanlışlıkla yayınlananların silinmesine izin ver; kullanıcıya da aynı
şekilde."** Bilimsel çizgi: rapor SESSİZCE SİLİNMEZ — **geri çekilir**
(retraction): veri dosyaları yayından kalkar, adresinde gerekçeli bildirim
kalır, DGR kimliği yeniden kullanılmaz, işlem günlüğe (`Geri çekildi`) ve git
geçmişine yazılır.

* **Yönetici**: herhangi bir yayını geri çekebilir.
* **Kullanıcı**: yalnız kendi projesinin bağlı olduğu parkın yayınını çekebilir
  (yayınlama yetkisiyle simetrik; `RETRACT_NOT_YOUR_PARK`, `DG0RP`).
* **Biçim kilidi**: `report_id` yalnız `^DGR-[0-9]{4}-[0-9]{4}$`
  (`RETRACT_BAD_ID`, `DG0RF`) — Actions dosya yolunu bu kimlikten kurar.
* **Kimlik**: `requested_by = auth.uid()` (`RETRACT_NOT_SELF`, `DG0RN`) +
  `is_active()` (`RETRACT_INACTIVE`, `DG0RI`).
* **Kota**: yönetici olmayan 24 saatte en fazla 3 geri çekme (`RETRACT_QUOTA`,
  `DG0RQ`); aynı rapor için ikinci bekleyen istek açılamaz
  (`RETRACT_DUPLICATE`, `DG0RD` + kısmi unique index).
* **Değişmezlik**: satır güncellenemez (update politikası YOK); delete yalnız
  yönetici. `select` anon'a açık (Actions işi + arayüz durumu buradan okur).
* **Eşleme doğrulaması**: park_id ↔ report_id eşleşmesi repo günlüğüyle
  doğrulanır; eşleşmeyen istek Actions'ta İŞLENMEZ (RLS yalnız park
  mülkiyetini görebilir).

> 0010 uygulanmazsa site çökmez: 🗑 isteği sunucuda reddedilir, arayüz
> "0010_report_retraction.sql çalıştırılmalı" der; yayın akışı etkilenmez.
> Bekçi: `test/retraction.test.mjs`; işletim: `docs/rapor-yayini.md` §4b.

## 0004 — park kimliği modeli (2026-09-24)

Kullanıcı isteği: *"Karşılaştırmada projelere verilen adlar değil direkt
algılanan parkların verisi gözüksün; 3 kişi Göksu Parkı'nda çalıştıysa veriler
proje olarak değil direkt Göksu Parkı olarak çıksın. Ölçüm yapılacağı zaman
direkt park algılama ekranına yönlendirsin. Projenin adı park adı + kullanıcının
belirlediği ad olsun (Göksu Parkı - deneme). Park algılamadan ölçüm girilemesin."*

| Parça | Ne yapar | Neden DB'de |
|---|---|---|
| `parks` | Fiziksel parkın TEK kimliği. Canonical anahtar `osm_key` (`way/123456`); elle oluşturulan parkta `manual/<ad>/<lat>/<lon>` (~100 m hücresi). UNIQUE → aynı park iki kez kaydedilemez. | Karşılaştırmanın park bazında toplanması istemcide ad eşleştirerek yapılamaz: iki kullanıcının verdiği proje adları farklıdır. Kimlik sunucuda tekilleşmeli. |
| `projects.park_id` + `label` | Proje artık bir parkın alt çalışması; `label` kullanıcının verdiği kısa ad. | Aynı parktaki 3 proje → 3 satır değil 1 satır. |
| `trg_compose_project_name` | `name` = `park adı + ' - ' + label` (label boşsa yalnız park adı); park şehir/ülkesini de doldurur. | İstemci kuralı unutsa/bypass etse bile ad bozulamaz; iki taraf aynı string'i üretir. |
| `measurements.park_id` | Denormalize kopya (proje bağlandığında geri doldurulur). | Toplulaştırma ve dışa aktarım hızı; view hem bunu hem `projects.park_id`'yi okur. |
| `trg_enforce_park_link` | Park bağı olmayan projeye ölçüm INSERT edilemez → `PARK_REQUIRED` (SQLSTATE `DG0PK`). UPDATE'te proje değişmiyorsa denetlemez (eski kayıtların onay akışı kilitlenmez). | İstemci kapısı (`dgParkGate`/`saveMeas`) atlanabilir; bilimsel veri setinde kural sunucuda da durmalı. |
| `v_park_compare` | Park bazında `group by`: kayıt, karbon, **katkıda bulunan kişi sayısı**, proje sayısı, tür sayısı, alan, t/ha. Parkı olmayanlar `park_id=0` + `park_pending=true`. | İstemcideki `.limit(5000)` kesilmesi biter (bkz. `src/utils/truncation.js`): satır sayısı park sayısıyla sınırlı. |
| `projects_update` genişletmesi | `owner or is_owner() or is_admin()` | "🌳 Parkları Geri Doldur" yönetim aracı başkalarının projelerini de parka bağlar; admin zaten ölçüm onaylayıp kullanıcı yönetiyor. |

**RLS:** `parks` herkese açık okunur (OSM türevi kamusal veri), yazma
`created_by = auth.uid() and is_active()`, silme yalnız `is_admin()`.
`v_park_compare` `security_invoker=true` → anon `projects` okuyamadığı için
view anon'a boş döner (karşılaştırma zaten giriş sonrası yüklenir; proje
adları kamusal veri değil).

**Park adı yazımı (0005):** OSM'de ad küçük harfle yazılmışsa ("göksu parkı")
bu ad proje adına, karşılaştırmaya ve raporlara yayılıyordu. `dg_tr_title()`
Türkçe duyarlı başlık düzeni uygular (`initcap` kullanılmaz: `initcap('işçi')`
→ `Işçı`, doğru olan `İşçi`). Tetikleyici **yalnız içinde hiç büyük harf
olmayan** adları düzeltir — `KOCAELİ PARK` gibi bilinçli yazımlara dokunmaz.
`name_norm` değişmez, dolayısıyla park eşleştirmesi bozulmaz; `projects.park_name`
tazelendiğinde `trg_compose_project_name` proje adını da otomatik düzeltir
("göksu parkı - deneme" → "Göksu Parkı - deneme").

**İstemci tarafı:** `src/services/park-registry.js` (kimlik yazma, algılama
akışı, ölçüm kapısı, geri doldurma aracı) + `test/park-identity.test.mjs`
(kural kilidi) + `test/park-flow.test.mjs` (sahte Supabase ile uçtan uca akış).
