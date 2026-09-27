-- 0009_user_report_publish.sql — KULLANICILAR KENDİ PARKINI YAYINLAYABİLİR (2026-09-28)
--
-- KULLANICI İSTEĞİ: "kullanıcılar kendi park projelerini paylaşabilecek
-- değil mi?" → doğrudan yayın seçildi: parkı için projesi olan kullanıcı,
-- yayın isteğini kuyruğa KENDİSİ yazar; yönetici hakkı değişmez.
--
-- DEĞİŞEN TEK ŞEY YETKİ KAPISIDIR — hat aynı hat:
--   report_requests (Beklemede) → rapor-yayin.yml (5 dk) → publish-queue.mjs
--   → make-report.mjs → rapor/DGR-…/ + yayin-kuyrugu.json → kalıcı bağlantı.
--   Actions tarafı kimin istediğine bakmaz; kuyruk anonim okunur (0008).
--
-- KİLİTLER (kötüye kullanım / Actions kuyruğu şişirmeye karşı, sunucu tarafı):
--   1. MÜLKİYET   Yönetici olmayan kullanıcı YALNIZ kendi projesinin bağlı
--                 olduğu park (projects.park_id) için istek açabilir.
--   2. KENDİ VERİSİ İsteyenin o parkta EN AZ BİR ONAYLI ölçümü olmalı —
--                 katkısı olmayan parkı yayınlayamaz.
--   3. KOTA       Yönetici olmayan kullanıcı 24 saatte EN FAZLA 3 istek
--                 açabilir (iptal edilenler de sayılır: aç-kapat döngüsü
--                 kuyruğu yoramaz).
--   4. KİMLİK     requested_by = auth.uid() zorunlu — başkası adına istek yok.
--   5. AKTİFLİK   is_active() (0001 deseni): engelli hesap istek açamaz.
--   6. 0008 KİLİTLERİ AYNEN DURUR: park başına TEK bekleyen istek (kısmi
--      unique index), parkta onaylı veri şartı (REPORT_NO_DATA), sonuç
--      tabloya yazılamaz (status kümesi kapalı), silme yalnız yönetici.
--
-- İPTAL: kullanıcı YALNIZ KENDİ bekleyen isteğini 'Vazgeçildi' yapabilir;
--        yöneticinin iptal hakkı değişmez.
--
-- RLS + tetikleyici İKİ KATMAN (0006/0008 deseni): politika atlanırsa bile
-- (service_role, gelecek bir politika hatası) tetikleyici aynı kuralları uygular.
--
-- Idempotent: tekrar tekrar çalıştırılabilir. 0008'in üzerine uygulanır.

begin;

-- ============ 1) SUNUCU KAPISI (0008'deki fonksiyonun yerini alır) ============
create or replace function public.tg_report_request_gate() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  n int;
  recent int;
  quota constant int := 3;   /* yönetici olmayan: 24 saatte en fazla bu kadar istek */
begin
  if public.is_admin() then
    /* YÖNETİCİ: 0008 kuralları aynen — mülkiyet/kota şartı yok,
     * aşağıdaki park geneli onaylı-veri kontrolü yine çalışır. */
    null;
  else
    /* 1) KİMLİK: istek yalnız kendi adına açılır. */
    if new.requested_by is distinct from auth.uid() then
      raise exception 'REPORT_NOT_SELF (DGR0NS): yayın isteği yalnız kendi adına açılabilir'
        using errcode = 'DG0NS';
    end if;

    /* 2) MÜLKİYET: kullanıcının bu parka bağlı projesi olmalı. */
    if not exists (
      select 1 from public.projects p
      where p.owner = auth.uid()
        and p.park_id = new.park_id
    ) then
      raise exception 'REPORT_NOT_YOUR_PARK (DGR0NP): park #% için projen yok — kullanıcılar yalnız kendi parkını yayınlayabilir', new.park_id
        using errcode = 'DG0NP';
    end if;

    /* 3) KENDİ VERİSİ: bu parkta en az bir ONAYLI ölçümü olmalı.
     *    park_id denormalizedir (0004); eski satırlar proje bağından bulunur. */
    if not exists (
      select 1
      from public.measurements m
      left join public.projects p2 on p2.id = m.project_id
      where m.owner = auth.uid()
        and m.status = 'Onaylı'
        and m.deleted_at is null
        and (m.park_id = new.park_id or p2.park_id = new.park_id)
    ) then
      raise exception 'REPORT_NO_OWN_DATA (DGR0ND): bu parkta onaylı ölçümün yok — ölçümlerin onaylanınca yayın isteyebilirsin'
        using errcode = 'DG0ND';
    end if;

    /* 4) KOTA: 24 saatte en fazla `quota` istek (iptal edilenler de sayılır). */
    select count(*) into recent
    from public.report_requests r
    where r.requested_by = auth.uid()
      and r.created_at > now() - interval '24 hours';
    if recent >= quota then
      raise exception 'REPORT_QUOTA (DGR0QT): 24 saatlik yayın isteği sınırına (%) ulaşıldı — sonra yeniden dene', quota
        using errcode = 'DG0QT';
    end if;
  end if;

  /* 5) HERKES İÇİN (0008'den aynen): parkta onaylı ölçüm yoksa rapor üretilemez. */
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

-- ============ 2) RLS ============
-- select (herkese) ve delete (yalnız yönetici) 0008'deki gibi KALIR;
-- burada dokunulmaz. Yalnız insert/update politikaları genişletilir.

drop policy if exists report_requests_insert on public.report_requests;
create policy report_requests_insert on public.report_requests
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      requested_by = auth.uid()
      and public.is_active()
      and exists (
        select 1 from public.projects p
        where p.owner = auth.uid()
          and p.park_id = report_requests.park_id
      )
    )
  );

/* İptal: yönetici HER bekleyen isteği, kullanıcı YALNIZ KENDİ bekleyen
 * isteğini 'Vazgeçildi' yapabilir (with check durumu ve kimliği kilitler). */
drop policy if exists report_requests_update on public.report_requests;
create policy report_requests_update on public.report_requests
  for update to authenticated
  using ((public.is_admin() or requested_by = auth.uid()) and status = 'Beklemede')
  with check ((public.is_admin() or requested_by = auth.uid()) and status = 'Vazgeçildi');

commit;

-- ============ 3) DOĞRULAMA (SQL Editor'da elle) ============
-- Fonksiyon ve tetikleyici yerinde mi:
--   select proname from pg_proc where proname='tg_report_request_gate';
--   select tgname from pg_trigger where tgname='trg_report_request_gate';
--
-- Normal kullanıcı olarak (kendi parkı, onaylı ölçümü var):
--   insert into public.report_requests(park_id,requested_by)
--   values (<kendi_park_id>, auth.uid());                → çalışır
--
-- Aynı kullanıcı, başkasının parkı için:
--   insert into public.report_requests(park_id,requested_by)
--   values (<yabancı_park_id>, auth.uid());               → DG0NP (REPORT_NOT_YOUR_PARK)
--
-- 4. istek (24 saat içinde):                             → DG0QT (REPORT_QUOTA)
-- Anon anahtarla POST:                                     → 401/RLS reddi
-- Kullanıcı, başkasının bekleyen isteğini iptale kalkarsa: → RLS 0 satır günceller
--
-- İstemci tarafı: 📁 Projeler → parkı bağlı projede 📄 düğmesi
--   (src/services/report-publish.js, kullanıcı bölümü).
