# supabase/ — veritabanı şeması, migration'lar ve güvenlik denetimi

Bu dizin projenin **gerçek şemasını** repoya taşır. Daha önce şema yalnızca
Supabase kontrol panelinde yaşıyordu; artık her değişiklik version control'da.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `migrations/0001_init_v2_1.sql` | Çalışır durumdaki TAM şema (kullanıcı tarafından sağlanan v2.1 + SECURITY PATCH v1). Idempotent. **Üzerine değişiklik yapılmaz.** |
| `migrations/0002_review_fixes.sql` | Kod incelemesinin 4 düzeltmesi (aşağıda). Idempotent. |
| `migrations/0003_audit_and_agg.sql` | Denetim izi (reviewed_by/at, reject_reason, deleted_at) + onay damgası trigger'ı + `v_world_agg` toplulaştırma view'ı. Idempotent. |
| `migrations/0004_parks.sql` | **Park kimliği**: `parks` tablosu (OSM elemanı = canonical anahtar), `projects.park_id/label/park_name`, `measurements.park_id`, `v_park_compare` view'ı, iki trigger (proje adı kurma + ölçüm kapısı). Idempotent. |
| `dump-schema.sh` | Canlı şemayı `supabase db dump` ile yeniden dökmek için yardımcı |
| `audit/rls-probe.sh` | Anon key ile 13 saldırı denemesi (yetki yükseltme dahil) |
| `audit/RLS-DENETIM.md` | Denetim listesi + sonuç tablosu (doldurulacak) |

## Nasıl uygulanır

Supabase SQL Editor'da sırayla:

1. `0001_init_v2_1.sql` → Run (idempotent, tekrar tekrar güvenli)
2. `0002_review_fixes.sql` → Run
3. `0003_audit_and_agg.sql` → Run (denetim izi + toplulaştırma view'ı)
4. `0004_parks.sql` → Run (park kimliği + ölçüm kapısı + karşılaştırma view'ı)
5. (Önerilir) `audit/rls-probe.sh`'i kendi makinenden çalıştır → sonuçları
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

**İstemci tarafı:** `src/services/park-registry.js` (kimlik yazma, algılama
akışı, ölçüm kapısı, geri doldurma aracı) + `test/park-identity.test.mjs`
(kural kilidi) + `test/park-flow.test.mjs` (sahte Supabase ile uçtan uca akış).
