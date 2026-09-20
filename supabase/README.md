# supabase/ — veritabanı şeması, migration'lar ve güvenlik denetimi

Bu dizin projenin **gerçek şemasını** repoya taşır. Daha önce şema yalnızca
Supabase kontrol panelinde yaşıyordu; artık her değişiklik version control'da.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `migrations/0001_init_v2_1.sql` | Çalışır durumdaki TAM şema (kullanıcı tarafından sağlanan v2.1 + SECURITY PATCH v1). Idempotent. **Üzerine değişiklik yapılmaz.** |
| `migrations/0002_review_fixes.sql` | Kod incelemesinin 4 düzeltmesi (aşağıda). Idempotent. |
| `dump-schema.sh` | Canlı şemayı `supabase db dump` ile yeniden dökmek için yardımcı |
| `audit/rls-probe.sh` | Anon key ile 13 saldırı denemesi (yetki yükseltme dahil) |
| `audit/RLS-DENETIM.md` | Denetim listesi + sonuç tablosu (doldurulacak) |

## Nasıl uygulanır

Supabase SQL Editor'da sırayla:

1. `0001_init_v2_1.sql` → Run (idempotent, tekrar tekrar güvenli)
2. `0002_review_fixes.sql` → Run
3. (Önerilir) `audit/rls-probe.sh`'i kendi makinenden çalıştır → sonuçları
   `audit/RLS-DENETIM.md` tablosuna işle

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
