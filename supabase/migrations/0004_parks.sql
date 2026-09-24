-- =====================================================
-- 🌲 DendroGeo — 0004: PARK KİMLİĞİ (park registry) + PROJE ↔ PARK BAĞI
-- Idempotent · 0003 üzerine · Supabase SQL Editor'da çalıştır
--
-- GEREKÇE (kullanıcı isteği 2026-09-24):
--  · "Park Karşılaştırma — Karbon Performansı" projelere VERİLEN ADLARI değil,
--    ALGILANAN PARKLARI göstermeli. 3 kişi Göksu Parkı'nda çalıştıysa üç ayrı
--    proje satırı değil, TEK "Göksu Parkı" satırı çıkmalı.
--  · Ölçüme geçmeden önce kullanıcı park algılama ekranına yönlendirilmeli;
--    park algılanmadan ölçüm girilememeli.
--  · Proje adı = park adı + kullanıcının etiketi → "Göksu Parkı - deneme".
--
-- ÇÖZÜM (5 parça):
--  1) public.parks        → fiziksel parkın TEK kimliği. Canonical anahtar OSM
--                            eleman kimliğidir (way/123456). Aynı parkı kim
--                            algılarsa algılasın AYNI satıra düşer; böylece
--                            karşılaştırma kendiliğinden park bazında toplanır.
--  2) projects.park_id    → proje artık bir parkın alt çalışmasıdır.
--     projects.label      → kullanıcının verdiği kısa ad ("deneme").
--     trg_compose_project_name → name'i DB TARAFINDA "park - etiket" kurar;
--                            istemci unutsa/bypass etse bile ad bozulamaz.
--  3) measurements.park_id→ toplulaştırma için denormalize kopya (view hem
--                            bunu hem projects.park_id'i yedekli okur).
--  4) v_park_compare      → karşılaştırma sayfasının TEK kaynağı. Sunucu
--                            tarafında park bazında group by; istemcideki
--                            .limit(5000) kesilmesi (bkz. truncation.js) biter.
--  5) trg_enforce_park_link → parkı olmayan projeye ölçüm INSERT edilemez
--                            (PARK_REQUIRED). İstemci kapısının sunucu tarafı
--                            garantisi: bypass edilirse veri yine girmez.
--
-- NOTLAR:
--  · v_park_compare security_invoker + yalnız authenticated grant: anon
--    projects'i okuyamadığı için view anon'da "permission denied" verir;
--    karşılaştırma sayfası zaten girişten sonra yüklenir (shell.js startShell
--    → loadWorld → loadParkCompare). parks tablosu ise anon'a açık (OSM
--    türevi kamusal veri).
--  · parks herkese açık okunur (OSM türevi kamusal veri); yazma yalnız
--    girişli kullanıcıya, silme yalnız yöneticiye açıktır.
-- =====================================================

-- ============ 1) PARK KİMLİK TABLOSU ============
create table if not exists public.parks (
  id           bigint generated always as identity primary key,
  /* Canonical kimlik: OSM elemanı için "way/123456", elle oluşturulan park için
   * "manual/<ad>/<enlem 3 hane>/<boylam 3 hane>". UNIQUE → aynı park iki kez
   * kaydedilemez. */
  osm_key      text not null,
  osm_type     text,                       -- way | relation | node | manual
  osm_id       bigint,
  name         text not null,
  name_norm    text not null,              -- küçük harf, aksansız, tek boşluk
  country      text,
  city         text,
  centroid_lat double precision,
  centroid_lon double precision,
  area_m2      double precision,
  source       text not null default 'osm'
               check (source in ('osm','manual','backfill')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint parks_osm_key_unique unique (osm_key)
);

create index if not exists idx_parks_name_norm on public.parks(name_norm);
create index if not exists idx_parks_geo      on public.parks(centroid_lat, centroid_lon);
create index if not exists idx_parks_city     on public.parks(country, city);

-- ============ 2) PROJE ↔ PARK BAĞI ============
alter table public.projects
  add column if not exists park_id   bigint references public.parks(id) on delete set null;
alter table public.projects
  add column if not exists park_name text;
alter table public.projects
  add column if not exists label     text;

create index if not exists idx_projects_park on public.projects(park_id);

-- ============ 3) ÖLÇÜM ↔ PARK (denormalize) ============
alter table public.measurements
  add column if not exists park_id bigint references public.parks(id) on delete set null;

create index if not exists idx_measurements_park on public.measurements(park_id);

-- Mevcut ölçümleri, projesi parka bağlıysa doldur (ilk kurulumda boş geçer)
update public.measurements m
   set park_id = p.park_id
  from public.projects p
 where p.id = m.project_id
   and m.park_id is null
   and p.park_id is not null;

-- ============ 4) PROJE ADI = "PARK ADI - ETİKET" (DB garantisi) ============
create or replace function public.compose_project_name() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  pk_name    text;
  pk_city    text;
  pk_country text;
  lbl        text;
begin
  if new.park_id is null then
    return new;                       -- parkı olmayan (eski) proje: ada dokunma
  end if;

  select name, city, country into pk_name, pk_city, pk_country
    from public.parks where id = new.park_id;

  if pk_name is null then
    return new;
  end if;

  new.park_name := pk_name;
  lbl := btrim(coalesce(new.label, ''));
  new.label := lbl;

  /* Kullanıcı isteği: "projenin adı park adı ve kullanıcının belirlediği ad
   * olsun, mesela göksu parkı - deneme gibi". Etiket boşsa ad = park adı. */
  new.name := case when lbl = '' then pk_name
                   else pk_name || ' - ' || lbl
              end;

  if btrim(coalesce(new.city, '')) = ''    then new.city    := pk_city;    end if;
  if btrim(coalesce(new.country, '')) = '' then new.country := pk_country; end if;

  return new;
end $$;

drop trigger if exists trg_compose_project_name on public.projects;
create trigger trg_compose_project_name
before insert or update on public.projects
for each row execute function public.compose_project_name();

-- ============ 5) PARKSIZ PROJEYE ÖLÇÜM GİRİLEMEZ (sunucu kapısı) ============
create or replace function public.enforce_park_link() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  pj_park bigint;
begin
  if new.project_id is null then
    return new;
  end if;

  /* UPDATE'te proje DEĞİŞMİYORSA denetleme: eski (park bağı olmayan) kayıtların
   * onay/red/düzenleme akışı kilitlenmemeli. Yalnız eksik park_id'yi doldur. */
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then
    if new.park_id is null then
      select park_id into pj_park from public.projects where id = new.project_id;
      new.park_id := pj_park;
    end if;
    return new;
  end if;

  select park_id into pj_park from public.projects where id = new.project_id;

  if pj_park is null and new.park_id is null then
    raise exception
      'PARK_REQUIRED: "%" projesine ölçüm girmeden önce park algılanmalı.',
      coalesce((select name from public.projects where id = new.project_id), 'bilinmeyen')
      using errcode = 'DG0PK';
  end if;

  new.park_id := coalesce(new.park_id, pj_park);
  return new;
end $$;

drop trigger if exists trg_enforce_park_link on public.measurements;
create trigger trg_enforce_park_link
before insert or update on public.measurements
for each row execute function public.enforce_park_link();

-- ============ 6) PARK BAZLI KARŞILAŞTIRMA VIEW'I ============
/* Karşılaştırma sayfasının tek kaynağı. Parkı olan projeler PARK adında
 * birleşir (3 kişi × 3 proje = 1 satır); parkı olmayan eski projeler kendi
 * adlarıyla park_id=0 ve park_pending=true olarak ayrıca görünür — veri
 * kaybolmaz, sıralamaya karışmaz. */
drop view if exists public.v_park_compare;
create view public.v_park_compare with (security_invoker=true) as
select
  coalesce(pk.id, 0)::bigint                       as park_id,
  coalesce(pk.name, pr.name, '—')                  as park_name,
  max(coalesce(pk.city, pr.city))                  as city,
  max(coalesce(pk.country, pr.country))            as country,
  count(*)::integer                                as records,
  count(distinct m.project_id)::integer            as projects,
  count(distinct m.owner)::integer                 as contributors,
  round(sum(m.carbon_kg)::numeric, 2)              as carbon_kg,
  round(avg(m.dbh_cm)::numeric, 1)                 as avg_dbh,
  round(avg(m.height_m)::numeric, 1)               as avg_height,
  count(*) filter (where m.grp = 'İBRELİ')::integer    as conifer_n,
  count(*) filter (where m.grp = 'YAPRAKLI')::integer  as broadleaf_n,
  count(distinct m.species)::integer              as species_n,
  max(pk.area_m2)                                  as area_m2,
  max(pk.centroid_lat)                             as centroid_lat,
  max(pk.centroid_lon)                             as centroid_lon,
  bool_or(pk.id is null)                           as park_pending
from public.measurements m
join public.projects pr on pr.id = m.project_id
left join public.parks pk on pk.id = coalesce(m.park_id, pr.park_id)
where m.status = 'Onaylı' and m.deleted_at is null
group by coalesce(pk.id, 0)::bigint, coalesce(pk.name, pr.name, '—');

comment on view public.v_park_compare is
  'Park bazlı karbon karşılaştırması: park_id=0 → park algılanmamış eski proje grubu.';

-- ============ 7) PARKS: RLS + GRANT ============
alter table public.parks enable row level security;

drop policy if exists parks_select on public.parks;
create policy parks_select on public.parks for select
  to anon, authenticated using (true);

/* Kayıt eklerken satır zaten varsa (aynı osm_key) istemci UPSERT yerine
 * select→insert yapar; yarış durumunda 23505 gelirse yeniden select eder.
 * Böylece başkasının park satırını güncelleme yetkisi gerekmez. */
drop policy if exists parks_insert on public.parks;
create policy parks_insert on public.parks for insert to authenticated
  with check (created_by = auth.uid() and public.is_active());

drop policy if exists parks_update on public.parks;
create policy parks_update on public.parks for update to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists parks_delete on public.parks;
create policy parks_delete on public.parks for delete to authenticated
  using (public.is_admin());

grant select on public.parks to anon, authenticated;
grant insert, update, delete on public.parks to authenticated;
/* v_park_compare YALNIZ authenticated'a açık — bilinçli:
 * view security_invoker olduğu için sorgu, çağıranın yetkisiyle altındaki
 * tablolara dokunur; anon'un projects üzerinde hiçbir hakkı yok (0001'deki
 * grant yalnız authenticated). Anon'a grant vermek "permission denied for
 * table projects" hatası üretir (yerel PostgreSQL 15'te doğrulandı).
 * Karşılaştırma sayfası zaten giriş sonrası yüklenir (shell.js → loadWorld).
 * İleride herkese açık bir park liderliği istenirse ya projects'e anon select
 * verilmeli ya da view security_definer yapılmalı — ikisi de ayrı bir karar. */
grant select on public.v_park_compare to authenticated;
revoke select on public.v_park_compare from anon;

/* ⚠ ZORUNLU: parks.id "generated always as identity" → INSERT, dizinin
 * USAGE hakkını ister. 0001'deki "grant usage on all sequences" parks
 * tablosundan ÖNCE çalıştığı için yeni dizi kapsanmıyor; PostgREST
 * authenticated rolüyle bağlandığından bu satır olmadan park kaydı
 * "permission denied for sequence parks_id_seq" ile patlar.
 * (Yerel PostgreSQL 15 üzerinde gerçek rol ile doğrulandı.) */
grant usage, select on all sequences in schema public to anon, authenticated;

/* updated_at'i taze tut (istemci göndermese bile) */
create or replace function public.touch_parks() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_parks on public.parks;
create trigger trg_touch_parks
before update on public.parks
for each row execute function public.touch_parks();

-- ============ 8) YÖNETİCİ PROJE DÜZELTEBİLSİN (park geri doldurma) ============
/* Neden: "Parkları Geri Doldur" yönetim aracı, park bağı eksik TÜM projeleri
 * (başka kullanıcılarınkiler dahil) OSM sorgusuyla parka bağlar. Eski politika
 * yalnız satır sahibi + kurucu (is_owner) izin veriyordu; admin rolündeki bir
 * kullanıcı aracın ortasında RLS'e takılıyordu. Admin zaten ölçüm
 * onaylayıp/silebiliyor ve kullanıcı yönetebiliyor; proje metadata'sını
 * düzeltebilmesi aynı yetki seviyesinin doğal parçası. */
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (owner = auth.uid() or public.is_owner() or public.is_admin());

-- ============ 9) MEVCUT PROJELER İÇİN ETİKET ÇIKARMA ============
/* Parka bağlanan eski projelerde name zaten serbest metin. compose_project_name
 * tetikleyicisi yalnız park_id YAZILDIĞINDA adı yeniden kurar; bağlanmamış
 * projelerin adı olduğu gibi kalır (veri kaybı yok). İstemci tarafındaki
 * "Parkları Geri Doldur" aracı eski adı etikete taşıyarak
 * "Göksu Parkı - <eski ad>" biçimini üretir; kullanıcı isterse sonra kısaltır. */

-- =====================================================
-- DOĞRULAMA (elle, SQL Editor'da):
--   select * from public.parks limit 5;
--   select park_name, projects, contributors, records, carbon_kg
--     from public.v_park_compare order by carbon_kg desc;
--   -- kapı testi (park bağı olmayan projede hata beklenir):
--   insert into public.measurements (owner, project_id, point_id, lat, lon, species, dbh_cm, height_m)
--   values (auth.uid(), <parksız_proje_id>, 1, 39.9, 32.8, 'Test', 10, 5);
--   -- → ERROR: PARK_REQUIRED
-- =====================================================
