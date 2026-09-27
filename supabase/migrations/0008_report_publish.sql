-- 0008_report_publish.sql — SİTE İÇİNDEN BİLİMSEL RAPOR YAYINI (2026-09-27)
--
-- KULLANICI İSTEĞİ: "raporu site üstünden yayınlayacağım" — GitHub Actions
-- arayüzüne gitmeden, uygulamanın içinden tek düğmeyle DGR kimlikli bilimsel
-- rapor yayınlanır ve kalıcı bağlantısı yine uygulama içinde görünür.
--
-- AKIŞ (üç adım, tek anahtar: report_requests.id)
--   1) İSTEK   Yönetici 🔐 Ölçüm Yönetimi → "📄 Bilimsel Rapor Yayını"
--              kartında parkın yanındaki 📄 Yayınla düğmesine basar →
--              bu tabloya status='Beklemede' satırı yazılır
--              (src/services/report-publish.js).
--   2) ÜRETİM  .github/workflows/rapor-yayin.yml 5 dakikada bir bekleyen
--              satırları ANON anahtarla okur (select politikası herkese açık),
--              scripts/publish-queue.mjs → scripts/make-report.mjs raporu
--              üretir ve rapor/DGR-YYYY-NNNN/ altına commit'ler.
--   3) SONUÇ   İşin sonucu repo'ya yazılır (rapor/yayin-kuyrugu.json) ve
--              Pages ile yayınlanır; uygulama durumu bu dosyadan okur,
--              kalıcı bağlantıyı + paylaş düğmesini kartta gösterir.
--
-- NEDEN SONUÇ TABLOYA YAZILMIYOR?
--   Actions'ın Supabase'e YAZMASI service_role anahtarı gerektirir. O anahtar
--   ne depoda ne tarayıcıda tutulur (depoda duran anahtar = veritabanının
--   tüm RLS kurallarının atlanması). Bu yüzden iş bölümü bilinçlidir:
--     · veritabanı = İSTEK (kim, hangi park, ne zaman, vazgeçti mi)
--     · git        = SONUÇ (hangi DGR, hangi hash, başarılı mı, neden değil)
--   İkisi de kamuya açık denetim izidir; birleştirme anahtarı request id'dir.
--
-- GÜVENLİK
--   · insert/update/delete YALNIZ is_admin() (RLS + tetikleyici, iki katman:
--     0006_park_admin_only.sql ile aynı desen). Anon istek açamaz → kuyruk
--     şişirilemez, Actions boşuna çalıştırılamaz.
--   · select HERKESE açık: Actions job'ı anon anahtarla okumak zorunda.
--     Satırlarda kişisel veri yok (park kimliği + profili UUID'si + zaman).
--   · aynı park için AYNI ANDA tek bekleyen istek (kısmi unique index):
--     çift tıklama iki rapor üretmez.
--   · onaylı ölçümü olmayan park için istek AÇILAMAZ (tetikleyici): boş
--     rapor üretimi baştan kesilir.
--
-- Idempotent: tekrar tekrar çalıştırılabilir.

begin;

-- ============ 1) ŞEMA ============
create table if not exists public.report_requests (
  id           uuid primary key default gen_random_uuid(),
  park_id      bigint not null references public.parks(id) on delete cascade,
  /* Rapor §4 (arazi örtüsü bağlamı) üretilsin mi? true = tam bilimsel rapor
   * (ESA WorldCover 10 m çözümlemesi dahil, ~1-3 dk). false = hızlı yayın
   * (yalnız envanter + karbon; LULC bölümü "çözümleme atlandı" olarak basılır). */
  with_lulc    boolean not null default true,
  status       text not null default 'Beklemede'
               check (status in ('Beklemede','Vazgeçildi')),
  requested_by uuid references public.profiles(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);

comment on table  public.report_requests is
  'Site içinden bilimsel rapor yayın istekleri (0008). İstek burada, sonuç rapor/yayin-kuyrugu.json içinde; Actions yalnız OKUR.';
comment on column public.report_requests.status is
  'Yalnız Beklemede/Vazgeçildi: yayın sonucunu (Yayınlandı/Başarısız) repo tarafındaki kuyruk günlüğü taşır — Actions''ın DB''ye yazma yetkisi yoktur.';
comment on column public.report_requests.with_lulc is
  'true = §4 arazi örtüsü çözümlemesi dahil (varsayılan); false = hızlı yayın.';

create index if not exists idx_report_requests_park    on public.report_requests(park_id);
create index if not exists idx_report_requests_created on public.report_requests(created_at);

/* Aynı park için aynı anda TEK bekleyen istek: çift tıklama / iki sekme iki
 * ayrı DGR üretmez. Kısmi index → yayınlanan/vazgeçilen satırlar engellemez. */
create unique index if not exists report_requests_one_pending_per_park
  on public.report_requests(park_id) where status = 'Beklemede';

-- ============ 2) İSTEK KAPISI (sunucu tarafı) ============
create or replace function public.tg_report_request_gate() returns trigger
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  /* RLS zaten is_admin() istiyor; bu ikinci katman RLS atlatılsa bile
   * (service_role, gelecekteki bir politika hatası) kuyruğu korur. */
  if not public.is_admin() then
    raise exception 'REPORT_ADMIN_ONLY (DGR0RP): rapor yayın isteğini yalnız yönetici oluşturabilir'
      using errcode = '42501';
  end if;

  select count(*) into n
    from public.measurements m
   where m.park_id = new.park_id
     and m.status = 'Onaylı'
     and m.deleted_at is null;

  if coalesce(n, 0) = 0 then
    raise exception 'REPORT_NO_DATA (DGR0RD): park #% için onaylı ölçüm yok — rapor üretilemez', new.park_id
      using errcode = '22023';
  end if;

  return new;
end $$;

drop trigger if exists trg_report_request_gate on public.report_requests;
create trigger trg_report_request_gate
  before insert or update of park_id on public.report_requests
  for each row execute function public.tg_report_request_gate();

-- ============ 3) RLS ============
alter table public.report_requests enable row level security;

drop policy if exists report_requests_select on public.report_requests;
create policy report_requests_select on public.report_requests
  for select
  using (true);   /* anon dahil: Actions job'ı bekleyen istekleri buradan okur */

drop policy if exists report_requests_insert on public.report_requests;
create policy report_requests_insert on public.report_requests
  for insert to authenticated
  with check (public.is_admin());

/* Yönetici yalnız BEKLEYEN isteği vazgeçmişe çevirebilir; yayınlanmış bir
 * isteğin satırı geçmiş kaydıdır, oynanamaz (with check durumu kilitler). */
drop policy if exists report_requests_update on public.report_requests;
create policy report_requests_update on public.report_requests
  for update to authenticated
  using (public.is_admin() and status = 'Beklemede')
  with check (public.is_admin() and status = 'Vazgeçildi');

drop policy if exists report_requests_delete on public.report_requests;
create policy report_requests_delete on public.report_requests
  for delete to authenticated
  using (public.is_admin());

-- ============ 4) YETKİLER ============
grant select on public.report_requests to anon, authenticated;
grant insert, update, delete on public.report_requests to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

commit;

-- ============ 5) DOĞRULAMA (SQL Editor'da elle) ============
-- select id, park_id, with_lulc, status, created_at from public.report_requests order by created_at desc limit 10;
--
-- RLS denetimi (anon anahtarla, giriş yapmadan):
--   curl "$SB/rest/v1/report_requests?select=id,park_id,status" -H "apikey: $ANON"   → 200 + satırlar
--   curl -X POST "$SB/rest/v1/report_requests" -H "apikey: $ANON" \
--        -H "Content-Type: application/json" -d '[{"park_id":5}]'                     → 401/42501 (reddedilmeli)
