-- =====================================================
-- 🌲 DendroGeo — 0005: PARK ADI YAZIM DÜZENİ (Türkçe duyarlı)
-- Idempotent · 0004 üzerine · Supabase SQL Editor'da çalıştır
--
-- GEREKÇE (kullanıcı isteği 2026-09-24):
--   OSM'de park adı küçük harfle yazılmışsa ("göksu parkı") bu ad park
--   kimliğine, oradan proje adına ("göksu parkı - deneme"), karşılaştırma
--   listesine ve raporlara aynen yayılıyordu. Kullanıcı: "büyük harf olsun".
--
-- NEDEN initcap() DEĞİL?
--   PostgreSQL'in initcap/upper fonksiyonları veritabanı yerelinein ASCII
--   kurallarını izler: initcap('işçi parkı') → 'Işçi Parkı' (Türkçe'de
--   doğru olan 'İşçi Parkı'). Aynı şekilde upper('i') → 'I' (olmalı 'İ'),
--   upper('ı') → 'I'. Yerelden bağımsız olması için Türkçe harfler ELLE
--   eşlenir (dg_tr_title).
--
-- KURAL (bilerek muhafazakâr):
--   Yalnız TAMAMEN küçük harfli adlar düzeltilir. İçinde büyük harf olan
--   adlara (KOCAELİ PARK, özel yazımlar, kısaltmalar, kullanıcının elle
--   verdiği adlar) DOKUNULMAZ — yani bu tetikleyici veri ezmez.
--
-- ETKİ ZİNCİRİ:
--   parks.name düzelir → trg_compose_project_name proje adını zaten
--   park adından kurduğu için, projects.park_name'i tazelemek proje adını
--   da kendiliğinden düzeltir ("göksu parkı - deneme" → "Göksu Parkı - deneme").
-- =====================================================

-- ============ 1) TÜRKÇE DUYARLI BAŞLIK DÜZENİ ============
create or replace function public.dg_tr_title(t text) returns text
language sql immutable as $$
  select coalesce(string_agg(
           case
             when left(w,1) = 'i' then 'İ' || substr(w,2)
             when left(w,1) = 'ı' then 'I' || substr(w,2)
             when left(w,1) = 'ş' then 'Ş' || substr(w,2)
             when left(w,1) = 'ğ' then 'Ğ' || substr(w,2)
             when left(w,1) = 'ü' then 'Ü' || substr(w,2)
             when left(w,1) = 'ö' then 'Ö' || substr(w,2)
             when left(w,1) = 'ç' then 'Ç' || substr(w,2)
             else upper(left(w,1)) || substr(w,2)
           end, ' ' order by ord), '')
    from regexp_split_to_table(btrim(coalesce(t,'')), '\s+')
         with ordinality as x(w, ord)
$$;

comment on function public.dg_tr_title(text) is
  'Türkçe duyarlı başlık düzeni: i→İ, ı→I. initcap() kullanılmaz (ASCII yereli Türkçeyi bozar).';

-- ============ 2) TETİKLEYİCİ: yalnız tamamen küçük harfli adlar ============
create or replace function public.park_name_case() returns trigger
language plpgsql as $$
begin
  /* [A-ZİIŞĞÜÖÇ] hiç geçmiyorsa ad tamamen küçük harflidir → düzelt.
   * Büyük harf içeren adlara dokunma (kullanıcının/OSM'nin bilinçli yazımı). */
  if new.name is not null and new.name !~ '[A-ZİIŞĞÜÖÇ]' then
    new.name := public.dg_tr_title(new.name);
  end if;
  return new;
end $$;

drop trigger if exists trg_park_name_case on public.parks;
create trigger trg_park_name_case
before insert or update of name on public.parks
for each row execute function public.park_name_case();

-- ============ 3) MEVCUT PARKLARI DÜZELT ============
update public.parks
   set name = public.dg_tr_title(name)
 where name is not null
   and name !~ '[A-ZİIŞĞÜÖÇ]';

-- ============ 4) PROJE ADLARINI YENİDEN KUR ============
/* park_name tazelenince trg_compose_project_name (0004) adı otomatik
 * "park adı - etiket" olarak yeniden kurar; ayrıca name'e dokunmaya gerek yok. */
update public.projects p
   set park_name = pk.name
  from public.parks pk
 where pk.id = p.park_id
   and p.park_name is distinct from pk.name;

-- ============ 5) GRANT ============
/* Fonksiyonlar tetikleyici içinden çalışır; istemcinin çağırması gerekmez.
 * Yine de SELECT hakkı verilir ki admin paneli isterse önizleme yapabilsin. */
grant execute on function public.dg_tr_title(text) to anon, authenticated;

-- =====================================================
-- DOĞRULAMA (SQL Editor):
--   select public.dg_tr_title('göksu parkı');      -- → Göksu Parkı
--   select public.dg_tr_title('işçi parkı');       -- → İşçi Parkı  (initcap bunu bozar)
--   select public.dg_tr_title('ıhlamur vadisi');   -- → Ihlamur Vadisi
--   select public.dg_tr_title('KOCAELİ PARK');     -- → (tetikleyici buna dokunmaz)
--   select id, name, name_norm from public.parks;  -- name_norm DEĞİŞMEZ (eşleştirme bozulmaz)
--   select id, name, park_name, label from public.projects;
--
-- NOT: name_norm bilinçli olarak elle düzeltilmez — park eşleştirmesi
-- (dgNormParkName) zaten aksansız/küçük harf biçimde çalışır; ad değişse de
-- aynı park aynı kimlikte kalır. İstemci mevcut kimliği bulduğunda adı
-- EZMEDEN satırı döndürdüğü için bu düzeltme kalıcıdır.
-- =====================================================
