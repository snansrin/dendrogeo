-- 0012_report_author.sql — Rapor YAZARI = yayını isteyen kullanıcı (2026-09-28)
--
-- Kullanıcı standardı: "kullanıcı yayınlama yaptığında yazar adı KULLANICININ
-- adı olsun; Şirin Nagihan / Şirin Sinan site KURUCULARIdır." Rapor motoru
-- (scripts/make-report.mjs) yazarı v_report_authors görünümünden okur;
-- görünüm yoksa/ad boşsa kurumsal ada düşer (İSİM UYDURULMAZ).
--
-- Gizlilik notu: bu görünüm YALNIZ rapor isteği/geri çekme isteği açmış
-- kullanıcıların full_name + organization alanını, park ve tarih bilgisiyle
-- birlikte anon'a açar (rapor kamuya açık bir yayın olduğundan yazar adı da
-- kamusaldır). E-POSTA VEYA BAŞKA PROFİL ALANI AÇILMAZ.
--
-- Idempotent: create or replace + drop/grant. RLS: görünüm security_invoker
-- değildir (görünümler kendi grant'ıyla okunur); dayanak tabloların RLS'i
-- anon'a kapalı olduğundan sızıntı yüzeyi bu görünümle SINIRLIDIR.

begin;

create or replace view public.v_report_authors as
select
  rr.created_at                as created_at,
  rr.park_id::bigint           as park_id,
  'report_request'::text       as kind,
  p.full_name                  as full_name,
  p.organization               as organization,
  rr.requested_by              as user_id
from public.report_requests rr
left join public.profiles p on p.id = rr.requested_by
where rr.requested_by is not null;

comment on view public.v_report_authors is
  'Rapor yayın isteklerinin yazar adları (anon okuma: rapor künyesi/atıf üretimi için). Yalnız full_name + organization; e-posta YOK.';

grant select on public.v_report_authors to anon, authenticated;

commit;

-- Doğrulama (Run sonrası):
--   select * from public.v_report_authors order by created_at desc limit 5;
-- Beklenti: park 25 isteği için 'Nagihan Şirin' (veya profilindeki ad) görünür.
-- Geri alma:
--   drop view if exists public.v_report_authors;
