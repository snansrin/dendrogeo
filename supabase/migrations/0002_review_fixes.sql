-- =====================================================
-- 🌲 DendroGeo — REVIEW DÜZELTMELERİ v1 (0002)
-- 0001_init_v2_1.sql üzerine İDEMPOTENT güvenlik/erişim düzeltmeleri
-- Kod incelemesi 2026-09-20 · her adım drop-if-exists ile güvenli
--
-- BULGULAR VE GEREKÇELER:
--
-- 1) Kullanıcı kendi profilini DÜZENLEYEMİYORDU
--    0001'de profiles_update yalnız is_owner() idi → kullanıcı kendi
--    adını/kurumunu güncelleyemez. "Kendi satırın OR owner" olarak düzeltildi.
--
-- 2) E-POSTA GİZLİLİĞİ: profiles_select using(true) idi
--    Giriş yapmış HER kullanıcı TÜM profillerin e-postasını okuyabiliyordu
--    (KVKK/GDPR açısından gereksiz yüzey). İstemci kodu denetlendi:
--    profiles(full_name) join'lerini yalnızca admin görünümleri kullanıyor
--    (admin.js); kendi profilini herkes id ile okuyor. Bu yüzden
--    "kendi satırın OR admin" güvenle daraltılır.
--
-- 3) WAYPOINT EKİP ERİŞİMİ: wp_update/wp_delete yalnız satır sahibi + admin
--    idi → bir projenin SAHİBİ, kendi projesinin waypoint'lerini işaretleyip
--    silemiyordu (arriveWp kendi WP'si olmayan satırda RLS'e takılır).
--    Proje sahibi eklendi. owner IS NULL miras satırları update'de korundu.
--
-- 4) COĞRAFİ SORGU PERFORMANSI: canlı harita status + lat/lon aralığı ile
--    sorguluyor; yalnızca tekil status indeksi vardı. Bileşik indeks eklendi.
-- =====================================================

-- 1) Kendi profilini güncelleyebilme
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner());

-- 2) E-posta gizliliği: select yalnız kendi satırın veya admin
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- 3) Waypoint'lerde proje sahibi de yönetebilir
drop policy if exists wp_update on public.waypoints;
create policy wp_update on public.waypoints for update to authenticated
  using (
    owner = auth.uid()
    or public.is_admin()
    or owner is null
    or exists (
      select 1 from public.projects p
      where p.id = waypoints.project_id and p.owner = auth.uid()
    )
  );

drop policy if exists wp_delete on public.waypoints;
create policy wp_delete on public.waypoints for delete to authenticated
  using (
    owner = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = waypoints.project_id and p.owner = auth.uid()
    )
  );

-- 4) Bileşik coğrafi + bölge indeksleri (canlı harita & bölge sorguları)
create index if not exists idx_measurements_geo
  on public.measurements (status, lat, lon);
create index if not exists idx_measurements_region
  on public.measurements (status, country, city);

-- =====================================================
-- NOTLAR (bilinçli olarak DEĞİŞTİRİLMEDİ):
--
-- · grant usage on all sequences ... to anon: anon yalnız site_visits'e
--   insert atıyor (ziyaret sayacı); identity dizisi için bu grant gerekli.
--   Daraltmak isterseniz: revoke edip yalnız site_visits_id_seq bırakın.
-- · enforce_approval trigger'ı ve storage folder izolasyonu DOĞRU kurulu;
--   dokunulmadı.
-- · İleride denetim izi istenirse (reviewed_by, reviewed_at, reject_reason,
--   deleted_at) ayrı bir 0003 migration'ı olarak eklenmeli; bu dosyaya
--   gömülmemeli (geri alınabilirlik).
-- =====================================================
