-- =====================================================
-- 🌲 DendroGeo — TAM VERİTABANI SCRIPTİ v2.1 (IDEMPOTENT)
-- Supabase SQL Editor'da güvenle tekrar tekrar çalıştırılabilir
-- v2.1 yenilikleri:
--   • client_id → DEFAULT UUID + NOT NULL (her insert otomatik korunur)
--   • (project_id, point_id, measurement_no) UNIQUE → çift ölçüm engeli
--   • Tüm riskli adımlar DO bloğu ile korunaklı (veri varsa atlar)
-- NOT: Bu dosya kullanıcı tarafından sağlanan çalışır durumdaki şemadır.
--      Üzerine değişiklik YAPILMAZ; düzeltmeler 0002_review_fixes.sql'de.
-- =====================================================

-- ============ 1) TABLOLAR ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, organization text, email text,
  role text not null default 'user' check (role in ('owner','admin','user')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id bigint generated always as identity primary key,
  owner uuid references public.profiles(id) on delete cascade,
  name text not null, country text, city text,
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id bigint generated always as identity primary key,
  owner uuid references public.profiles(id) on delete cascade,
  project_id bigint references public.projects(id) on delete cascade,
  point_id integer not null, measurement_no integer not null default 1,
  lat double precision not null, lon double precision not null,
  altitude_m double precision, accuracy_m double precision,
  slope_deg double precision default 0, country text, city text,
  grp text, species text, dbh_cm double precision, height_m double precision,
  volume_m3 double precision, carbon_kg double precision,
  photo_url text, photo_file text,
  shared boolean not null default true,
  status text not null default 'Beklemede',
  created_at timestamptz not null default now()
);

create table if not exists public.waypoints (
  id bigint generated always as identity primary key,
  owner uuid, project_id bigint references public.projects(id) on delete cascade,
  wp_id integer not null, lat double precision not null, lon double precision not null,
  visited boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, wp_id)
);

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visited_at timestamptz not null default now()
);

create table if not exists public.data_requests (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  email text, country text, city text, project_name text, note text,
  status text not null default 'Beklemede',
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

-- ============ 2) CLIENT_ID (OFFLINE SYNC DUPLICATE ÖNLEME) ============
ALTER TABLE public.measurements ADD COLUMN IF NOT EXISTS client_id text;

-- Mevcut boşları doldur
UPDATE public.measurements
SET client_id = gen_random_uuid()::text
WHERE client_id IS NULL OR client_id = '';

-- Yeni insert'lere otomatik UUID (JS göndermese bile DB korur)
ALTER TABLE public.measurements
ALTER COLUMN client_id SET DEFAULT gen_random_uuid()::text;

-- NOT NULL yap (boşlar doldurulduğu için güvenli)
ALTER TABLE public.measurements
ALTER COLUMN client_id SET NOT NULL;

-- UNIQUE constraint (idempotent)
ALTER TABLE public.measurements DROP CONSTRAINT IF EXISTS measurements_client_id_unique;
ALTER TABLE public.measurements ADD CONSTRAINT measurements_client_id_unique UNIQUE (client_id);

-- Aynı proje + nokta + ölçüm no kombinasyonu unique (veri varsa atlar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'measurements_unique_point') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.measurements
      GROUP BY project_id, point_id, measurement_no
      HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE public.measurements
      ADD CONSTRAINT measurements_unique_point UNIQUE (project_id, point_id, measurement_no);
      RAISE NOTICE '✅ measurements_unique_point eklendi';
    ELSE
      RAISE NOTICE '⚠️ Mükerrer (proje, nokta, ölçüm no) kayıtlar var — constraint atlandı';
    END IF;
  END IF;
END $$;

-- ============ 3) CHECK CONSTRAINTS ============
alter table public.measurements drop constraint if exists measurements_status_check;
alter table public.measurements add constraint measurements_status_check
  check (status in ('Beklemede','Onaylı','Red'));

alter table public.data_requests drop constraint if exists data_requests_status_check;
alter table public.data_requests add constraint data_requests_status_check
  check (status in ('Beklemede','İşleme Alındı','Tamamlandı','Reddedildi'));

-- ============ 4) PERFORMANS İNDEKSLERİ ============
create index if not exists idx_measurements_owner   on public.measurements(owner);
create index if not exists idx_measurements_project on public.measurements(project_id);
create index if not exists idx_measurements_status  on public.measurements(status);
create index if not exists idx_measurements_client  on public.measurements(client_id);
create index if not exists idx_measurements_point   on public.measurements(project_id, point_id);
create index if not exists idx_waypoints_project    on public.waypoints(project_id);
create index if not exists idx_data_requests_user   on public.data_requests(user_id);
create index if not exists idx_site_visits_at       on public.site_visits(visited_at);

-- ============ 5) RLS AÇ ============
alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.measurements  enable row level security;
alter table public.waypoints     enable row level security;
alter table public.site_visits   enable row level security;
alter table public.data_requests enable row level security;

-- ============ 6) KAYIT OLUNCA PROFİL OLUŞTUR ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, full_name, organization, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'organization', new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ 7) YETKİ FONKSİYONLARI ============
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='owner'); $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin')); $$;

-- ============ 8) VIEW'LAR ============
drop view if exists public.v_global;
drop view if exists public.v_country;
drop view if exists public.v_city;

create view public.v_global with (security_invoker=true) as
select count(*)::integer as records,
       count(distinct country)::integer as countries,
       count(distinct city)::integer as cities,
       round(sum(carbon_kg)::numeric/1000,2) as carbon_t
from public.measurements where status='Onaylı';

create view public.v_country with (security_invoker=true) as
select country, count(*)::integer as records,
       round(sum(carbon_kg)::numeric/1000,2) as carbon_t,
       round(avg(dbh_cm)::numeric,1) as avg_dbh,
       round(avg(height_m)::numeric,1) as avg_height
from public.measurements where status='Onaylı' group by country;

create view public.v_city with (security_invoker=true) as
select city, count(*)::integer as records,
       round(sum(carbon_kg)::numeric/1000,2) as carbon_t,
       round(avg(height_m)::numeric,1) as avg_height
from public.measurements where status='Onaylı' group by city;

-- ============ 9) RLS POLİTİKALARI ============
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (public.is_owner());

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (true);
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated with check (owner = auth.uid());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated using (owner = auth.uid() or public.is_owner());
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated using (owner = auth.uid() or public.is_owner());

drop policy if exists meas_select on public.measurements;
create policy meas_select on public.measurements for select to anon, authenticated
  using (status='Onaylı' or (auth.role()='authenticated' and (owner = auth.uid() or public.is_admin())));
drop policy if exists meas_insert on public.measurements;
create policy meas_insert on public.measurements for insert to authenticated with check (owner = auth.uid());
drop policy if exists meas_update on public.measurements;
create policy meas_update on public.measurements for update to authenticated using (owner = auth.uid() or public.is_admin());
drop policy if exists meas_delete on public.measurements;
create policy meas_delete on public.measurements for delete to authenticated using (owner = auth.uid() or public.is_admin());

drop policy if exists wp_select on public.waypoints;
create policy wp_select on public.waypoints for select to authenticated using (true);
drop policy if exists wp_insert on public.waypoints;
create policy wp_insert on public.waypoints for insert to authenticated with check (true);
drop policy if exists wp_update on public.waypoints;
create policy wp_update on public.waypoints for update to authenticated using (true);
drop policy if exists wp_delete on public.waypoints;
create policy wp_delete on public.waypoints for delete to authenticated using (true);

drop policy if exists site_visits_insert on public.site_visits;
create policy site_visits_insert on public.site_visits for insert to anon, authenticated with check (true);
drop policy if exists site_visits_select on public.site_visits;
create policy site_visits_select on public.site_visits for select to authenticated using (public.is_admin());

drop policy if exists dreq_select on public.data_requests;
create policy dreq_select on public.data_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists dreq_insert on public.data_requests;
create policy dreq_insert on public.data_requests for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists dreq_update on public.data_requests;
create policy dreq_update on public.data_requests for update to authenticated
  using (public.is_admin());

-- ============ 10) GRANT ============
grant select on public.measurements to anon, authenticated;
grant select, insert, update, delete on public.measurements to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.waypoints to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.v_global, public.v_country, public.v_city to anon, authenticated;
grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;
grant select, insert, update on public.data_requests to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- ============ 11) DEPOLAMA (fotoğraflar) ============
insert into storage.buckets (id, name, public) values ('dendro-photos','dendro-photos', true)
on conflict (id) do nothing;

drop policy if exists "dendro_photos_public_read" on storage.objects;
create policy "dendro_photos_public_read" on storage.objects for select using (bucket_id='dendro-photos');
drop policy if exists "dendro_photos_auth_insert" on storage.objects;
create policy "dendro_photos_auth_insert" on storage.objects for insert to authenticated with check (bucket_id='dendro-photos');
drop policy if exists "dendro_photos_auth_delete" on storage.objects;
create policy "dendro_photos_auth_delete" on storage.objects for delete to authenticated using (bucket_id='dendro-photos');

-- ============ 12) KURUCU ============
insert into public.profiles (id, full_name, organization, email)
select id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'organization', email
from auth.users on conflict (id) do nothing;

update public.profiles set role='owner', active=true where email='snansrin@gmail.com';

-- 🛡 DendroGeo SECURITY PATCH v1

-- 1) Admin olmayan status'ü ASLA "Onaylı" yapamaz (onay bypass engeli)
create or replace function public.enforce_approval() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'Beklemede';
    elsif new.status <> 'Beklemede' then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_approval on public.measurements;
create trigger trg_enforce_approval
before insert or update on public.measurements
for each row execute function public.enforce_approval();

-- 2) "Pasifleştir" butonu GERÇEKTEN engellesin
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true);
$$;

drop policy if exists meas_insert on public.measurements;
create policy meas_insert on public.measurements for insert to authenticated
  with check (owner = auth.uid() and public.is_active());

drop policy if exists meas_update on public.measurements;
create policy meas_update on public.measurements for update to authenticated
  using ((owner = auth.uid() and public.is_active()) or public.is_admin());

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (owner = auth.uid() and public.is_active());

drop policy if exists dreq_insert on public.data_requests;
create policy dreq_insert on public.data_requests for insert to authenticated
  with check (user_id = auth.uid() and public.is_active());

-- 3) Waypoint sabotajı: başkasının listesini değiştiremez/silemez
drop policy if exists wp_insert on public.waypoints;
create policy wp_insert on public.waypoints for insert to authenticated
  with check (owner = auth.uid() or public.is_admin());
drop policy if exists wp_update on public.waypoints;
create policy wp_update on public.waypoints for update to authenticated
  using (owner = auth.uid() or public.is_admin() or owner is null);
drop policy if exists wp_delete on public.waypoints;
create policy wp_delete on public.waypoints for delete to authenticated
  using (owner = auth.uid() or public.is_admin());

-- 4) Fotoğraf terörü: sadece kendi klasörüne yükler, kendi/admin siler
drop policy if exists "dendro_photos_auth_insert" on storage.objects;
create policy "dendro_photos_auth_insert" on storage.objects for insert to authenticated
  with check (bucket_id='dendro-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "dendro_photos_auth_delete" on storage.objects;
create policy "dendro_photos_auth_delete" on storage.objects for delete to authenticated
  using (bucket_id='dendro-photos' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
