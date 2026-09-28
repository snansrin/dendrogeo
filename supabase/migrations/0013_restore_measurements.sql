-- 0013_restore_measurements.sql — VERİ SAHİBİNİN KARARI: Göksu (park 25)
-- kayıtları, sahibinin ELLE GİRDİĞİ özgün değerlere geri döndürülür (2026-09-28)
--
-- Bağlam: 0011, cihaz kolonunu "göğüs çevresi" sayıp dbh_cm = çevre/π
-- dönüşümü uygulamıştı. Veri sahibi (N. Şirin) girdiği sayıların GÖĞÜS ÇAPI
-- olduğunu beyan etti → dönüşüm geri alınır. HAM saha değerleri girth_cm
-- kolonunda ve measurements_bak_0011 yedeğinde DURUR (silinmez); rapor QA
-- kapısı (h/D denetimi) beyanı sayıyla denetlemeye DEVAM eder — bilimsel
-- şeffaflık ilkesi gereği sistem susmaz, kararı veri sahibi verir.
--
-- KAPSAM DIŞI (bilerek korunur):
--   · parks.geom_json düzeltmesi (gerçek OSM poligonu) — iade EDİLMEZ
--   · P7 ondalık kayması düzeltmesi (196,2 → 1972,8): çap/boy DEĞİŞMEZ,
--     yalnız 10x kayan karbon onarılır
--   · girth_cm kolonu ve yedek tablo — kanıt zinciri kalır
--
-- İDEMPOTENT: yalnız "mevcut dbh_cm = girth_cm/π (±0,005)" olan satırlar
-- döner. 0013'ten sonra elle düzelttiğiniz kayıt OLURSA bu SQL onu EZMEZ.

begin;

with restored as (
  update public.measurements m
     set dbh_cm    = b.dbh_cm,
         height_m  = b.height_m,
         species   = b.species,
         grp       = b.grp,
         carbon_kg = b.carbon_kg,
         volume_m3 = b.volume_m3
  from public.measurements_bak_0011 b
  where m.id = b.id
    and m.park_id = 25
    and m.girth_cm is not null
    and abs(m.dbh_cm - round((m.girth_cm / pi())::numeric, 2)::double precision) < 0.005
  returning m.id
)
select count(*) as "iade edilen kayit (34 beklenir)" from restored;

-- P7 ondalık kayması onarımı (veriden bağımsız kanıtlı arıza: cihaz 1962'yi
-- 196,2 yazmış; saklı değer, formülün 100·(1/10) üssü kadar altında).
-- ÇAP/BOY DEĞİŞMEZ; yalnız carbon_kg panel denklemiyle onarılır → 1972,8.
update public.measurements m
   set carbon_kg = round((
         0.5922 * 0.0673 * power(
           (case m.species
              when 'KARAÇAM' then 470
              else case m.grp when 'İBRELİ' then 446 when 'YAPRAKLI' then 541 else 493 end
            end) / 1000.0 * m.dbh_cm * m.dbh_cm * m.height_m, 0.976)
       )::numeric, 1)::double precision
 where m.park_id = 25
   and m.point_id = 7
   and m.dbh_cm = 107                       -- sizin girdiğiniz çap korunur
   and m.carbon_kg between 150 and 250;     -- yalnız kaymış değer onarılır

-- ============ DOĞRULAMA ============
-- Beklenti: 34 kayıt · çaplar 40–200 · toplam ≈ 50,7 t (P7 ondalık düzeltmesi
-- dahil: 50,51 + ~1,78) · girth_cm kanıtı korunur.
select count(*)                                             as kayit,
       round(min(dbh_cm)::numeric, 1)                       as min_cap,
       round(max(dbh_cm)::numeric, 1)                       as max_cap,
       round((sum(carbon_kg) / 1000)::numeric, 2)           as toplam_t,
       count(*) filter (where girth_cm is not null)         as girth_kanit,
       count(*) filter (where abs(dbh_cm - round((girth_cm / pi())::numeric, 2)::double precision) < 0.005) as "halen_donuk_0_olmali"
from public.measurements
where park_id = 25 and status = 'Onaylı' and deleted_at is null;

-- P7 kontrolü: çap 107 (sizin değeriniz), karbon 1972,8 (10x kayma onarılmış).
select point_id, dbh_cm, girth_cm, height_m, carbon_kg, volume_m3
from public.measurements
where park_id = 25 and point_id in (7, 23, 32) and status = 'Onaylı'
order by point_id;

commit;

-- Not: Bu iadeden sonra yeni üretilecek rapor §7'de "Envanter tutarlılığı
-- (h/d) ⛔" ve "karbon toplamı GEÇİCİDİR" beyanını basar — bu bir ARIZA
-- DEĞİL, sistemin dürüstlük kapısıdır (belirsizlik beyanı). Rapor yine de
-- üretilir ve yayımlanır; bilimsel iletişimde bu uyarıyla birlikte anılmalıdır.
