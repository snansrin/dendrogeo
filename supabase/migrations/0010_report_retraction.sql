-- 0010_report_retraction.sql — YAYIMLANMIŞ RAPORU GERİ ÇEKME (2026-09-28)
--
-- KULLANICI İSTEĞİ: "yönetici kısmına yayınları silme yetkisi ver, yanlışlıkla
-- yayınlananların silinmesine izin ver; kullanıcıya da aynı şekilde."
--
-- BİLİMSEL ÇİZGİ: yayımlanmış rapor SESSİZCE SİLİNMEZ — GERİ ÇEKİLİR
-- (retraction). DGR kimliği kalıcıdır ve yeniden kullanılmaz; raporun
-- bulunduğu adreste veri dosyaları kaldırılır, yerine gerekçeli bir geri
-- çekme bildirimi konur. İşlem rapor/yayin-kuyrugu.json günlüğüne ve git
-- geçmişine yazılır → denetim izi korunur (bkz. docs/rapor-yayini.md §5).
--
-- AKIŞ (yayınla aynı hat, ters yön):
--   🗑 Geri çek → report_retractions ('Beklemede')
--              → rapor-yayin.yml (5 dk) → scripts/publish-queue.mjs
--              → rapor/DGR-…/{data.json,olcum.csv,park.geojson,harita.png,
--                 metadata.json} silinir; index.html geri çekme bildirimine
--                 döner; rapor/index.html listesinden düşer
--              → günlük kaydı: status='Geri çekildi' (+gerekçe, tarih, kimlik)
--
-- YETKİ (RLS + tetikleyici İKİ KATMAN, 0008/0009 deseni):
--   · YÖNETİCİ: herhangi bir yayını geri çekebilir.
--   · KULLANICI: YALNIZ kendi projesinin bağlı olduğu parkın yayınını geri
--     çekebilir (yayınlama yetkisiyle simetrik: yayınlayabilen, yanlışlıkla
--     yayınladığını geri de çeker). park_id ↔ report_id eşleşmesinin DOĞRUSU
--     repo günlüğündedir; Actions işi eşleşmeyen satırı İŞLEMEZ (istemci
--     beyanına güvenilmez).
--   · Kimlik: requested_by = auth.uid(); aktif hesap (is_active); kota:
--     yönetici olmayan 24 saatte en fazla 3 geri çekme isteği açabilir.
--   · Biçim: report_id ^DGR-\d{4}-\d{4}$ olmak zorunda (yol enjeksiyonu yok).
--   · Satır DEĞİŞTİRİLEMEZ (update politikası yok): istek kaydı denetim
--     izidir; sonuç günlükte durur. Silme yalnız yönetici (hatalı istek
--     kaydının temizliği).
--
-- Idempotent: tekrar tekrar çalıştırılabilir. 0008+0009'un üzerine uygulanır.

begin;

-- ============ 1) TABLO ============
create table if not exists public.report_retractions (
  id           uuid primary key default gen_random_uuid(),
  report_id    text not null,               -- DGR-YYYY-NNNN (biçim tetikleyicide kilitli)
  park_id      integer not null,            -- geri çekmenin konusu park (eşleşme günlükle doğrulanır)
  reason       text,                        -- gerekçe (kamuya açık günlükte yayımlanır)
  status       text not null default 'Beklemede'
               check (status in ('Beklemede')),  -- kapalı küme: sonuç DB'ye yazılamaz (0008 ilkesi)
  requested_by uuid not null default auth.uid(),
  created_at   timestamptz not null default now()
);

comment on table public.report_retractions is
  'Yayımlanmış DGR raporlarının geri çekme istekleri. Sonuç repo günlüğündedir (rapor/yayin-kuyrugu.json); tablo yalnız istek kaydı tutar.';

-- aynı rapor için ikinci bekleyen istek açılmasın (düğme spam'i kuyruğu şişirmesin)
create unique index if not exists uq_report_retraction_pending
  on public.report_retractions (report_id)
  where status = 'Beklemede';

-- ============ 2) SUNUCU KAPISI (tetikleyici) ============
create or replace function public.tg_report_retraction_gate() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  recent int;
  quota constant int := 3;   /* yönetici olmayan: 24 saatte en fazla bu kadar geri çekme */
begin
  -- 1) BİÇİM: DGR kimliği kalıbı dışına çıkılamaz — Actions bu kalıba göre
  --    dosya yolu kurar; serbest metin report_id = yol enjeksiyonu riski.
  if new.report_id !~ '^DGR-[0-9]{4}-[0-9]{4}$' then
    raise exception 'RETRACT_BAD_ID (DGR0RF): report_id DGR-YYYY-NNNN biçiminde olmalı'
      using errcode = 'DG0RF';
  end if;

  /* 2) KİMLİK: istek yalnız kendi adına açılır (yönetici dahil). */
  if new.requested_by is distinct from auth.uid() then
    raise exception 'RETRACT_NOT_SELF (DGR0RN): geri çekme isteği yalnız kendi adına açılabilir'
      using errcode = 'DG0RN';
  end if;

  if not public.is_admin() then
    -- 3) AKTİFLİK: engelli hesap istek açamaz (0001 deseni).
    if not public.is_active() then
      raise exception 'RETRACT_INACTIVE (DGR0RI): hesap etkin değil'
        using errcode = 'DG0RI';
    end if;

    -- 4) MÜLKİYET: kullanıcının bu parka bağlı projesi olmalı (0009 ile
    --    simetrik: kendi parkının yayınını geri çekebilir).
    if not exists (
      select 1 from public.projects p
      where p.owner = auth.uid()
        and p.park_id = new.park_id
    ) then
      raise exception 'RETRACT_NOT_YOUR_PARK (DGR0RP): park #% için projen yok — kullanıcılar yalnız kendi parkının yayınını geri çekebilir', new.park_id
        using errcode = 'DG0RP';
    end if;

    -- 5) KOTA: 24 saatte en fazla quota geri çekme isteği.
    select count(*) into recent
    from public.report_retractions r
    where r.requested_by = auth.uid()
      and r.created_at > now() - interval '24 hours';
    if recent >= quota then
      raise exception 'RETRACT_QUOTA (DGR0RQ): 24 saatlik geri çekme sınırına (%) ulaşıldı — sonra yeniden dene', quota
        using errcode = 'DG0RQ';
    end if;
  end if;

  -- 6) YİNELEME: aynı rapor için bekleyen istek varken yenisi açılamaz
  --    (kısmi unique index de aynı işi görür; bu dostane mesajı verir).
  if exists (
    select 1 from public.report_retractions r
    where r.report_id = new.report_id
      and r.status = 'Beklemede'
      and r.id is distinct from new.id
  ) then
    raise exception 'RETRACT_DUPLICATE (DGR0RD): bu rapor için bekleyen bir geri çekme isteği zaten var'
      using errcode = 'DG0RD';
  end if;

  return new;
end $$;

drop trigger if exists trg_report_retraction_gate on public.report_retractions;
create trigger trg_report_retraction_gate
  before insert on public.report_retractions
  for each row execute function public.tg_report_retraction_gate();

-- ============ 3) RLS ============
alter table public.report_retractions enable row level security;

drop policy if exists report_retractions_select on public.report_retractions;
create policy report_retractions_select on public.report_retractions
  for select to anon, authenticated
  using (true);   -- günlük gibi açık: Actions işi ve arayüz durumu buradan okur

drop policy if exists report_retractions_insert on public.report_retractions;
create policy report_retractions_insert on public.report_retractions
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      public.is_admin()
      or (
        public.is_active()
        and exists (
          select 1 from public.projects p
          where p.owner = auth.uid()
            and p.park_id = report_retractions.park_id
        )
      )
    )
  );

-- update politikası YOK: istek kaydı değiştirilemez (denetim izi).
drop policy if exists report_retractions_delete on public.report_retractions;
create policy report_retractions_delete on public.report_retractions
  for delete to authenticated
  using (public.is_admin());

-- ============ 4) YETKİLER ============
grant select on public.report_retractions to anon, authenticated;
grant insert, delete on public.report_retractions to authenticated;

commit;

-- ============ 5) DOĞRULAMA (SQL Editor'da elle) ============
-- Fonksiyon ve tetikleyici yerinde mi:
--   select proname from pg_proc where proname='tg_report_retraction_gate';
--   select tgname from pg_trigger where tgname='trg_report_retraction_gate';
--
-- Normal kullanıcı, kendi parkının yayını için:
--   insert into public.report_retractions(report_id,park_id,reason)
--   values ('DGR-2026-0002', <kendi_park_id>, 'yanlış park yayımlandı');   → çalışır
--
-- Aynı kullanıcı, başkasının parkı için:                                     → DG0RP
-- Bozuk kimlik ('../../etc' gibi):                                           → DG0RF
-- Aynı rapora ikinci bekleyen istek:                                         → DG0RD
-- 4. istek (24 saat içinde):                                                 → DG0RQ
-- Anon anahtarla POST:                                                       → 401/RLS reddi
--
-- İstemci tarafı: 🗑 Geri çek düğmesi yönetici kartında ve kullanıcı
--   panelinde (src/services/report-publish.js); işleyici
--   scripts/publish-queue.mjs (rapor-yayin.yml, 5 dk'da bir).
