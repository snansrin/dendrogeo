-- 0014_publish_request_fix.sql — "bekleyen istek" kilidini aç (2026-09-28)
--
-- HATA: report_requests_one_pending_per_park kısmi unique index'i, İŞLENMİŞ
-- ama DB'de hâlâ 'Beklemede' duran satırları da sayıyordu. Actions'ın
-- Supabase'e YAZMA yetkisi YOK (0008 güvenlik tasarımı: service_role depoda
-- tutulmaz; işleme sonucu git günlüğündedir) → istek satırları hiçbir zaman
-- kapanmaz. Sonuç: park bir kez yayınlandığında İKİNCİ yayın isteği
-- "Bu park için bekleyen bir istek zaten var" / unique çakışması ile
-- kalıcı olarak bloke oluyordu (28.09.2026'da Göksu'da yaşandı).
--
-- ÇÖZÜM: unique index KALKAR. Çift üretim koruması zaten iki katmanda var:
--   · panel: yalniz durumu 'Beklemede' VE günlükte sonucu OLMAYAN istekleri
--     sayar (report-publish.js dgPubEntryFor) → düğme kilitlenir, toast atar;
--   · kuyruk: publish-queue planQueue() günlüğe request_id'si işlenmiş
--     istekleri atlar (already) → aynı istek iki DGR üretmez.
-- Yani koruma "tek gerçek kaynağı" olan git günlüğünde; DB index'i buna
-- kör olduğu için yalnızca meşru istekleri engelliyordu.
--
-- Idempotent: drop if exists. Geri alma dosyanın sonunda (BİLİNÇLİ olarak
-- yeniden eklemeyin: aynı kilidi geri getirir).

begin;

drop index if exists public.report_requests_one_pending_per_park;

comment on table public.report_requests is
  'Rapor yayın istekleri. NOT (0014): DB düzeyinde "park başına tek Beklemede" kilidi YOKTUR — işlenmiş istekler yazma yetkisi olmadığından Beklemede kalır; çift üretim koruması panel + publish-queue planQueue üzerinde, request_id ⇔ rapor/yayin-kuyrugu.json eşleşmesiyle yapılır.';

commit;

-- Doğrulama: index kalktı mı?
select indexname from pg_indexes
where tablename = 'report_requests';
-- Beklenti: idx_report_requests_created (ve varsa pk index'i) — 
-- 'report_requests_one_pending_per_park' GÖRÜNMEMELİ.

-- Mevcut takılı satır zararsızdır (kuyruk onu request_id'den tanır ve
-- atlar); silmek istersen:
--   update public.report_requests set status = 'Vazgeçildi', cancelled_at = now()
--   where park_id = 25 and status = 'Beklemede';

-- Geri alma (ÖNERİLMEZ — hatayı geri getirir):
--   create unique index report_requests_one_pending_per_park
--     on public.report_requests(park_id) where status = 'Beklemede';
