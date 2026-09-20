-- =====================================================
-- 🌲 DendroGeo — 0003: DENETİM İZİ + TOPLULAŞTIRMA VIEW'ı
-- Idempotent · 0002 üzerine · Supabase SQL Editor'da çalıştır
--
-- GEREKÇE (kod incelemesi 2026-09-20):
--  · Onay/moderasyon akışında KİM ne zaman onayladı/reddetti kaydı yoktu.
--    Bilimsel veri setinde denetim izi (provenance) şarttır.
--  · İstemci istatistikleri ham satırları çekip tarayıcıda topluyor ve
--    .limit() eşiklerinde sessizce kesiliyordu. Sunucu tarafı toplulaştırma
--    view'ı hem doğru hem hızlı çözümüdür.
-- =====================================================

-- 1) DENETİM SÜTUNLARI
alter table public.measurements add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.measurements add column if not exists reviewed_at timestamptz;
alter table public.measurements add column if not exists reject_reason text;
alter table public.measurements add column if not exists deleted_at timestamptz;

-- Yumuşak silme için kısmi indeks (aktif kayıtlar hızlı)
create index if not exists idx_measurements_live
  on public.measurements (status) where deleted_at is null;

-- 2) ONAY DAMGASI: status her değiştiğinde kim/ne zaman otomatik yazılır
create or replace function public.stamp_review() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status is distinct from old.status then
    if public.is_admin() then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_stamp_review on public.measurements;
create trigger trg_stamp_review
before update on public.measurements
for each row execute function public.stamp_review();

-- 3) SUNUCU TARAFI TOPLULAŞTIRMA (istemci .limit() kesilmelerine son)
-- İstemci istatistikleri bu view'dan okunabilir: satır sayısı
-- gün×ülke×şehir×grup×tür mertebesinde kalır, milyon ölçümde bile küçük.
create or replace view public.v_world_agg with (security_invoker=true) as
select
  date_trunc('day', created_at)::date as day,
  country, city, grp, species,
  count(*)::integer                    as n,
  round(sum(carbon_kg)::numeric, 2)    as carbon_kg,
  round(avg(dbh_cm)::numeric, 1)       as avg_dbh,
  round(avg(height_m)::numeric, 1)     as avg_height
from public.measurements
where status = 'Onaylı' and deleted_at is null
group by 1, 2, 3, 4, 5;

grant select on public.v_world_agg to anon, authenticated;

-- =====================================================
-- NOTLAR:
--  · deleted_at henüz istemcide kullanılmıyor (sert silme devam ediyor).
--    Sütun, yumuşak silmeye geçiş için hazır; geçiş ayrı bir commit olmalı.
--  · v_world_agg security_invoker: anon yalnız 'Onaylı' kesiti görür
--    (measurements RLS'i üzerinden).
--  · reject_reason UI'a bağlanabilir (admin reddetme formu) — ayrı iş.
-- =====================================================
