-- 0007_geo_fence.sql — KONUM DOĞRULAMASI + PROJE↔PARK KİLİDİ (2026-09-26)
--
-- KULLANICI İSTEĞİ: "proje yapılacağı zaman veya projeye fotoğraf ekleneceği
-- zaman konumdan doğrulama alsın; aynı projeye farklı parklardan giriş
-- yapılmasın; her proje park ile eşitlensin; hatalı girişlerin önüne geçilsin."
--
-- TASARIM: iki katmanlı çit.
--   · İSTEMCİ (src/services/geofence.js): taze GPS fix'i (±60 m eşik) + park
--     poligonunun içinde mi / kenarına ≤40 m mi? Değilse yükleme HİÇ BAŞLAMAZ
--     (fotoğraf dahil). Doğrulama damgası satıra yazılır (geo_verified_at).
--   · SUNUCU (bu dosya): istemci atlatılsa bile (elle API çağrısı, eski sürüm,
--     çevrimdışı kuyruk) trg_geo_fence ölçümün parkın dışında olmasını REDDEDER.
--     Sunucuda tam poligon testi (ray-casting, jsonb) + geometri yoksa
--     alan-yarıçaplı daire yedeği kullanılır.
--
-- GERİYE UYUM: mevcut satırlara dokunulmaz (trigger yalnız INSERT ve
-- lat/lon/project_id/park_id UPDATE'inde çalışır). geom_json'ı olmayan ESKİ
-- parklar daire yedeğiyle korunur; yeni taramalar geometriyi sunucuya yazar.
-- parksız miras projeler (park_id null) çitin dışındadır — onları istemci
-- kapısı (dgParkGate) ve trg_enforce_park_link zaten engelliyor.

begin;

-- ============ 1) ŞEMA ============
alter table public.parks
  add column if not exists geom_json jsonb;   -- {outer:[[lat,lon]...], inner:[...]}

alter table public.measurements
  add column if not exists geo_verified_at timestamptz,   -- istemci poligon doğrulaması
  add column if not exists geo_dist_m      double precision, -- park merkezine uzaklık (m)
  add column if not exists geo_acc_m       double precision, -- GPS hassasiyeti (m)
  add column if not exists geo_override_by uuid references public.profiles(id) on delete set null;

comment on column public.parks.geom_json is
  'Park halkaları: {outer:[[[lat,lon],...]], inner:[...]} — istemci taramada yazar; trg_geo_fence sunucuda aynı poligonla doğrular.';
comment on column public.measurements.geo_override_by is
  'Yönetici konum-çiti istisnası (audit izi). Doluysa trigger çiti uygulamaz.';

-- ============ 2) GEOMETRİ YARDIMCILARI ============
create or replace function public.dg_hav_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select 6371008.8 * 2 * asin(least(1.0, greatest(-1.0, sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians(lon2 - lon1) / 2) ^ 2 ))));
$$;

/* Ray-casting (istemcideki pointInPolygon ile aynı matematik).
 * ring: jsonb dizi [[lat,lon], ...] */
create or replace function public.dg_point_in_ring(
  lat double precision, lon double precision, ring jsonb)
returns boolean language plpgsql immutable as $$
declare
  n int; i int; j int;
  yi double precision; xi double precision;
  yj double precision; xj double precision;
  inside boolean := false;
begin
  if ring is null then return false; end if;
  n := jsonb_array_length(ring);
  if n < 3 then return false; end if;
  j := n;
  for i in 1..n loop
    yi := (ring -> (i - 1) ->> 0)::double precision;
    xi := (ring -> (i - 1) ->> 1)::double precision;
    yj := (ring -> (j - 1) ->> 0)::double precision;
    xj := (ring -> (j - 1) ->> 1)::double precision;
    if ((yi > lat) <> (yj > lat)) and
       (lon < (xj - xi) * (lat - yi) / nullif(yj - yi, 0) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end $$;

create or replace function public.dg_point_in_park(
  lat double precision, lon double precision, geom jsonb)
returns boolean language plpgsql immutable as $$
declare
  r jsonb; inside boolean := false;
begin
  if geom is null or geom -> 'outer' is null then return false; end if;
  for r in select * from jsonb_array_elements(geom -> 'outer') loop
    if public.dg_point_in_ring(lat, lon, r) then inside := true; exit; end if;
  end loop;
  if not inside then return false; end if;
  if geom -> 'inner' is not null then
    for r in select * from jsonb_array_elements(geom -> 'inner') loop
      if public.dg_point_in_ring(lat, lon, r) then return false; end if;
    end loop;
  end if;
  return true;
end $$;

/* Geometrisi henüz sunucuda olmayan ESKİ parklar için yedek çit:
 * alan eşdeğeri daire + %25 pay, en az 150 m. */
create or replace function public.dg_park_radius_m(area double precision)
returns double precision language sql immutable as $$
  select greatest(150.0, sqrt(coalesce(area, 0) / pi()) * 1.25);
$$;

-- ============ 3) ÖLÇÜM ÇİTİ ============
create or replace function public.tg_geo_fence() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  park bigint; rec record; d double precision; inside boolean; pname text;
begin
  /* Yönetici istisnası: çiti atla ama yetkiyi denetle (audit izi kalır). */
  if new.geo_override_by is not null then
    if not public.is_admin() then
      raise exception 'GEO_OVERRIDE_ADMIN: konum istisnasını yalnız yönetici işleyebilir'
        using errcode = '42501';
    end if;
    return new;
  end if;

  park := new.park_id;
  if park is null then
    select park_id into park from public.projects where id = new.project_id;
    new.park_id := park;              -- denormalize kopyayı taze tut
  end if;
  if park is null then return new; end if;   -- parksız miras: istemci kapısı engelliyor

  if new.lat is null or new.lon is null then
    raise exception 'GEO_REQUIRED: konum (lat/lon) olmadan ölçüm kaydedilemez'
      using errcode = '23514';
  end if;

  select geom_json, centroid_lat, centroid_lon, area_m2, name
    into rec from public.parks where id = park;
  if rec.centroid_lat is null then return new; end if;

  d := public.dg_hav_m(new.lat, new.lon, rec.centroid_lat, rec.centroid_lon);
  new.geo_dist_m := round(d::numeric, 1);
  inside := public.dg_point_in_park(new.lat, new.lon, rec.geom_json);

  if inside or d <= public.dg_park_radius_m(rec.area_m2) then
    return new;
  end if;

  raise exception 'GEO_FENCE: bu ölçüm % parkının dışında (merkeze ~% m) — aynı projeye başka parktan giriş yapılamaz',
    rec.name, round(d)::int
    using errcode = '23514';
end $$;

drop trigger if exists trg_geo_fence on public.measurements;
create trigger trg_geo_fence
  before insert or update of lat, lon, project_id, park_id on public.measurements
  for each row execute function public.tg_geo_fence();

-- ============ 4) HER PROJE BİR PARKA BAĞLI ============
create or replace function public.tg_project_requires_park() returns trigger
language plpgsql as $$
begin
  if new.park_id is null then
    raise exception 'PROJECT_REQUIRES_PARK: her proje bir park ile eşleşmeli (park algıla → proje aç)'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_project_requires_park on public.projects;
create trigger trg_project_requires_park
  before insert on public.projects
  for each row execute function public.tg_project_requires_park();

commit;
