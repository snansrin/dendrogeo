-- 0015_report_data_owner.sql — YAZAR = VERİ SAHİBİ (2026-09-28)
--
-- Kullanıcı standardı: "yazar adı KULLANICININ adı olsun" — yani PARKIN
-- VERİSİNİ ÖLÇEN kişi. 0012 yazarı 'son yayın isteğini açan kullanıcı'dan
-- çözüyordu; DGR-2026-0004'te istek Sinan'dan gelince künyede Sinan yazdı
-- (oysa 34 kaydın sahibi Nagihan). Bu migration yazar seçimini düzeltir:
--
--   ÖNCELİK 1 · dg_park_author(park)  → parkın onaylı kayıtlarının en çok
--                                       katkı veren sahibi (ölçen kişi)
--   ÖNCELİK 2 · v_report_authors      → son yayın isteğini açan kullanıcı (0012)
--   ÖNCELİK 3 · kurumsal yazar        → DendroGeo (İSİM UYDURULMAZ)
--
-- Neden fonksiyon? profiles tablosu anon'a kapalı (RLS: authenticated) ve
-- Actions'ın yalnız anon anahtarı var. SECURITY DEFINER fonksiyon YALNIZ
-- full_name/organization döndürür (e-posta ve başka alan ASLA), yalnız
-- istenen parkın katkı sahibi için. Görünümler SECURITY DEFINER olamadığı
-- için bu yol seçildi (0007'deki dg_point_in_park ile aynı desen).
--
-- Idempotent: create or replace + drop/grant.

begin;

create or replace function public.dg_park_author(park bigint)
returns table(full_name text, organization text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.organization
  from (
    select m.owner
    from public.measurements m
    where m.park_id = park
      and m.status = 'Onaylı'
      and m.deleted_at is null
      and m.owner is not null
    group by m.owner
    order by count(*) desc, m.owner
    limit 1
  ) top
  join public.profiles p on p.id = top.owner
$$;

revoke all on function public.dg_park_author(bigint) from public;
grant execute on function public.dg_park_author(bigint) to anon, authenticated;

comment on function public.dg_park_author(bigint) is
  'Parkın en çok onaylı katkısı olan kullanıcısının adı (rapor yazarı — ÖNCELİK 1). Yalnız full_name/organization döner; e-posta ve diğer profil alanları SIZMAZ. Rapor motoru: dg_park_author → v_report_authors → kurumsal yazar.';

commit;

-- Doğrulama (Run sonrası):
--   select * from public.dg_park_author(25);
-- Beklenti: 'Nagihan Şirin' (park 25'in 34 kaydının sahibi).
-- Geri alma:
--   drop function if exists public.dg_park_author(bigint);
--   (rapor motoru otomatik olarak 0012 görünümüne geri düşer)
