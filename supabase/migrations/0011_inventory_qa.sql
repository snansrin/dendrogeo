-- 0011_inventory_qa.sql — Envanter kalite düzeltmesi (QA v2.1 · 2026-09-28)
--
-- GÖKSU PARKI (park 25 · proje 26 · N. Şirin · 28.09.2026 · 34 onaylı kayıt)
-- saha denetiminde üç sistemik hata doğrulandı:
--
--   B1) BİRİM: cihaz çıktısının "Çap" kolonu GÖĞÜS ÇEVRESİ taşıyordu
--       (34/34 kayıtta h/D oranı 5–16; olgun park ağacında 20–100 beklenir).
--       Saha fotoğrafları ölçekle doğrulandı: P7 gövde ~35 cm (çevre 107 →
--       π ile birebir), P29 fidan ~13 cm (çevre 40), P32 ~64 cm (çevre 200).
--       Düzeltme: girth_cm = eski dbh_cm (HAM DEĞER SİLİNMEZ),
--                 dbh_cm  = round(girth_cm / π, 2).
--   B2) ρ: 11 kayıt sözlük dışı tür adıyla girmişti (SALKIM SÖĞÜT, MAVİ LADİN,
--       DOĞU ÇINARI, ATLAS SEDİRİ, CEVİZ) → grup varsayılanıyla hesaplanmıştı.
--       Sözlük genişletildi (src/config/species.js, kaynaklı ρ'larla).
--       Düzeltme: carbon_kg ve volume_m3 panel denklemiyle YENİDEN hesaplanır
--       (Chave vd. 2014: AGB = 0,0673·(ρ·D²·H)^0,976; BGB = 0,26·AGB;
--        C = 0,47·(AGB+BGB) = 0,5922·AGB).
--       Bu adım P7'deki ondalık kaymasını da (196,2 ← 1962) kendiliğinden onarır.
--   B3) SINIR: parks.geom_json (park 25) park sınırı değil 5 noktalı
--       DİKDÖRTGENdi (jeodezik 68,93 ha ≠ künye 50,11 ha) → rapor v2 "alan
--       dengesi" QA kapısı LULC'yi %37,6 farkla bloke ediyordu.
--       Düzeltme: gerçek OSM poligonu (way/423602737, 111 nokta, ~50,00 ha).
--
-- İDEMPOTENT: adım 2 yalnız girth_cm IS NULL satırları çevirir (ikinci turda
-- π ile tekrar bölmez); adım 3 yalnız çevrilmiş satırları yeniden hesaplar;
-- adım 4 jsonb_set ile aynı değeri yazar. Tek transaction: ya hep ya hiç.
-- RLS: SQL Editor oturumu postgres rolündedir → politikalar atlanır.
-- trg_geo_fence YALNIZ "update of lat, lon, project_id, park_id" üzerinde
-- çalışır; bu migration konum kolonlarına DOKUNMAZ → tetikleyici sessizdir.
-- Yeni ölçümler konum çitine adım 4'ten SONRA tabidir (gerçek poligon).

begin;

-- ============ 1) ŞEMA: ham çevre kolonu + güvenlik yedeği ============
alter table public.measurements add column if not exists girth_cm double precision;

create table if not exists public.measurements_bak_0011 (
  id bigint primary key,
  dbh_cm double precision, height_m double precision,
  carbon_kg double precision, volume_m3 double precision,
  species text, grp text, backed_up_at timestamptz not null default now()
);

-- Göksu envanterinin (park 25) bugünkü değerlerini BİREBİR yedekle.
insert into public.measurements_bak_0011 (id, dbh_cm, height_m, carbon_kg, volume_m3, species, grp)
select m.id, m.dbh_cm, m.height_m, m.carbon_kg, m.volume_m3, m.species, m.grp
from public.measurements m
where m.park_id = 25
  and m.girth_cm is null                       -- yalnız ilk turda yedekle
  and m.dbh_cm > 0
on conflict (id) do nothing;

-- ============ 2) B1 · ÇEVRE → DBH ============
-- Kapsam: park 25, çevrilmemiş (girth_cm IS NULL), pozitif çaplı satırlar.
-- Ham değer girth_cm'e taşınır; dbh_cm = girth_cm / π (site yöntem kartıyla aynı).
with fix as (
  update public.measurements m
     set girth_cm = m.dbh_cm,
         dbh_cm   = round((m.dbh_cm / pi())::numeric, 2)::double precision
   where m.park_id = 25
     and m.girth_cm is null
     and m.dbh_cm > 0
  returning m.id
)
select count(*) as "B1 cevre-dbh donusturulen kayit" from fix;

-- ============ 3) B2 · ρ + yeniden hesap (panel denklemiyle birebir) ============
-- Yalnız adım 2'nin çevirdiği satırlar (dbh_cm = girth_cm/π bağı ile tanınır).
-- ρ tablosu src/config/species.js'ten ÜRETİLDİ (44 tür; tek gerçek
-- kaynak orası — buraya elle değer eklemeyin, önce sözlüğü güncelleyin).
with fix as (
  update public.measurements m
     set carbon_kg = round((
           0.5922 * 0.0673 * power(
             (
      case m.species
        when 'AĞLAYAN SÖĞÜT' then 400
        when 'AKÇAAĞAÇ' then 540
        when 'AMBERAĞACI' then 520
        when 'ARDIÇ' then 460
        when 'AT KESTANESİ' then 490
        when 'ATLAS SEDİRİ' then 490
        when 'CEVİZ' then 560
        when 'ÇINAR' then 600
        when 'DİŞBUDAK' then 562
        when 'DOĞU ÇINARI' then 600
        when 'DUT' then 570
        when 'FISTIK ÇAMI' then 470
        when 'GLEDİÇYA' then 600
        when 'GÖKNAR' then 350
        when 'GÜMÜŞ LADİN' then 450
        when 'GÜRGEN' then 630
        when 'HALEP ÇAMI' then 480
        when 'HİMALAYA SEDİRİ' then 430
        when 'HUŞ' then 540
        when 'IHLAMUR' then 420
        when 'KARAAĞAÇ' then 570
        when 'KARAÇAM' then 470
        when 'KATALPA' then 400
        when 'KAVAK' then 350
        when 'KAYIN' then 530
        when 'KESTANE' then 500
        when 'KIZILAĞAÇ' then 407
        when 'KIZILÇAM' then 478
        when 'KRİPTOMERYA' then 350
        when 'LADİN' then 358
        when 'MANOLYA' then 500
        when 'MAVİ LADİN' then 450
        when 'MAZI (YALANCI SERVİ)' then 450
        when 'MEŞE' then 570
        when 'PORSUK' then 640
        when 'SALKIM SÖĞÜT' then 400
        when 'SARIÇAM' then 426
        when 'SEDİR' then 430
        when 'SERVİ' then 510
        when 'SIĞLA' then 468
        when 'SÖĞÜT' then 410
        when 'SÜS ELMASI' then 650
        when 'SÜS ERİĞİ' then 630
        when 'YALANCI AKASYA' then 660
        else case m.grp when 'İBRELİ' then 446 when 'YAPRAKLI' then 541 else 493 end
      end
             ) / 1000.0 * m.dbh_cm * m.dbh_cm * m.height_m,
             0.976
           )
         )::numeric, 1)::double precision,
         volume_m3 = round((
           pi() * power(m.dbh_cm / 200.0, 2) * m.height_m * 0.5
         )::numeric, 3)::double precision
   where m.park_id = 25
     and m.girth_cm is not null
     and abs(m.dbh_cm - round((m.girth_cm / pi())::numeric, 2)::double precision) < 0.005
     and m.height_m > 0
  returning m.id
)
select count(*) as "B2 karbon-hacim yeniden hesap" from fix;

-- ============ 4) B3 · Göksu park sınırı ============
-- geom_json: gerçek OSM poligonu way/423602737 (erişim: 2026-09-28,
-- https://api.openstreetmap.org/api/0.6/way/423602737/full.json — ODbL).
-- 111 nokta, kapalı halka, jeodezik alan ~50,00 ha (künye 50,11 ha →
-- alan dengesi eşiği %0,5'in içinde). 34/34 ölçüm noktası poligon içinde
-- (ray-casting ile doğrulandı) → çit ihlali doğmaz.
update public.parks p
   set geom_json = jsonb_set(
         coalesce(p.geom_json, '{}'::jsonb),
         '{outer}',
         to_jsonb(array[[[39.997033,32.655579],[39.994236,32.655214],[39.993878,32.655171],[39.993673,32.6551],[39.993273,32.654829],[39.993082,32.654717],[39.992881,32.654668],[39.992708,32.654623],[39.992532,32.654615],[39.99185,32.654557],[39.99164,32.654539],[39.991494,32.654485],[39.991393,32.654441],[39.991299,32.654379],[39.991205,32.654299],[39.991117,32.654204],[39.990936,32.65399],[39.990851,32.653854],[39.990769,32.653674],[39.9906,32.653312],[39.990445,32.652912],[39.989491,32.650466],[39.988476,32.648378],[39.988284,32.647917],[39.988278,32.647876],[39.988251,32.647723],[39.988209,32.647498],[39.988316,32.646031],[39.988345,32.645697],[39.988406,32.645266],[39.988464,32.644961],[39.98853,32.644662],[39.988698,32.644244],[39.988788,32.644051],[39.988832,32.643956],[39.988853,32.643938],[39.988881,32.64393],[39.98894,32.643959],[39.989112,32.644098],[39.989279,32.644224],[39.989536,32.644428],[39.989567,32.64444],[39.9896,32.644439],[39.989668,32.644427],[39.989775,32.644398],[39.989809,32.644394],[39.989995,32.64433],[39.990171,32.64437],[39.990202,32.644357],[39.99024,32.644354],[39.990271,32.644354],[39.990304,32.644363],[39.990359,32.644386],[39.990409,32.644414],[39.990452,32.644443],[39.990465,32.644464],[39.990473,32.644495],[39.990488,32.644557],[39.990843,32.644757],[39.991066,32.644898],[39.991188,32.644976],[39.991472,32.645155],[39.991705,32.645287],[39.992043,32.645498],[39.992433,32.645744],[39.99248,32.646169],[39.992684,32.646482],[39.992724,32.646544],[39.992766,32.646604],[39.992802,32.646635],[39.992858,32.646671],[39.992902,32.646705],[39.992946,32.646736],[39.992992,32.646767],[39.993041,32.646784],[39.993141,32.646813],[39.993269,32.646842],[39.993582,32.646909],[39.993887,32.646974],[39.994171,32.647036],[39.994454,32.647098],[39.994605,32.647146],[39.994656,32.64719],[39.9947,32.647238],[39.994739,32.647287],[39.99478,32.647349],[39.994847,32.647459],[39.994912,32.647584],[39.994936,32.647641],[39.994951,32.647698],[39.994961,32.647753],[39.994969,32.647808],[39.994973,32.647863],[39.994977,32.64792],[39.99497,32.648041],[39.994958,32.648655],[39.994682,32.649565],[39.994462,32.65042],[39.994421,32.650714],[39.994417,32.65074],[39.99435,32.65122],[39.994316,32.651481],[39.994226,32.652331],[39.994342,32.652784],[39.994637,32.653202],[39.995457,32.653555],[39.996211,32.653908],[39.996633,32.654148],[39.997456,32.65456],[39.997402,32.65471],[39.997033,32.655579]]]::double precision[][])
       )
 where p.id = 25
   and p.osm_key = 'way/423602737';

-- ============ 5) BEYANLAR (elle girişin sınırları) ============
-- accuracy_m: 34 kayıtta NULL. UYDURMUYORUZ — rapor §4.1/§9 artık
-- "kaydedilmedi" beyan eder (QA v2.1). Yeni saha çıktısında cihaz
-- hassasiyetini yazın: scripts/import-measurements.mjs bu kolonu taşır.
--
-- P33 ≡ P35 (çap+boy birebir, konum ~3 m): mükerrer şüphesi SAHADA
-- doğrulanmadan silinmez. Doğrulanırsa:
--   update public.measurements set status='Red',
--     reject_reason='0011 QA: P33 mükerreri', deleted_at=now()
--   where park_id=25 and point_id=35;
--
-- Foto–nokta kayması (P4→P005_M1.JPG, P5→P006_M1.JPG, P6→P006_M2.JPG):
-- dosya adları cihaz kartından geldi; içerik doğrulaması SAHADA yapılır,
-- SQL'den otomatik düzeltilmez.

-- ============ 6) DOĞRULAMA ============
-- Beklenti: 34 kayıt · toplam ≈ 5,0–5,6 t (düzeltme öncesi 50,51 t idi;
-- oran ≈ π^1,952 ≈ 9,3x + ρ düzeltmeleri). h/D oranları ~17–51 aralığına oturur.
select count(*)                                          as kayit,
       round(sum(carbon_kg) / 1000, 3)                   as toplam_t,
       round(min(height_m / nullif(dbh_cm / 100, 0)), 1) as "min h/D",
       round(max(height_m / nullif(dbh_cm / 100, 0)), 1) as "max h/D",
       count(*) filter (where girth_cm is not null)      as cevre_sakli,
       count(*) filter (where volume_m3 is not null)     as hacim_dolu,
       count(*) filter (where carbon_kg is null or carbon_kg <= 0) as "karbon_bozuk_0_olmali"
from public.measurements
where park_id = 25 and status = 'Onaylı' and deleted_at is null;

select species as tur, grp as grup, count(*) as n,
       round(avg(dbh_cm), 1) as "ort_cap_cm",
       round(sum(carbon_kg), 1) as "karbon_kg"
from public.measurements
where park_id = 25 and status = 'Onaylı' and deleted_at is null
group by species, grp
order by sum(carbon_kg) desc;

-- Sınır doğrulaması: dış halka artık dikdörtgen DEĞİL (nokta sayısı > 5).
select id, name,
       jsonb_array_length(geom_json->'outer'->0) as "halka_noktasi",
       area_m2
from public.parks where id = 25;

commit;

-- Geri alma (gerekiyorsa):
--   begin;
--   update public.measurements m
--      set dbh_cm = b.dbh_cm, height_m = b.height_m, carbon_kg = b.carbon_kg,
--          volume_m3 = b.volume_m3, species = b.species, grp = b.grp,
--          girth_cm = null
--   from public.measurements_bak_0011 b where m.id = b.id;
--   update public.parks set geom_json = null where id = 25;  -- rapor OSM'e düşer
--   commit;
