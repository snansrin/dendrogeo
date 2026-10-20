#!/usr/bin/env node
import { reportRead } from './lib/report-reader.mjs';
import {decodeReportContext} from './lib/report-context.mjs';
/* publish-queue.mjs — SİTE İÇİNDEN GELEN RAPOR YAYIN İSTEKLERİNİ İŞLER
 *
 * NEDEN VAR (2026-09-27 · kullanıcı isteği: "raporu site üstünden
 * yayınlayacağım"): rapor üretmek için GitHub Actions arayüzüne gidip
 * workflow_dispatch çalıştırmak gerekiyordu. Bu betik + rapor-yayin.yml o adımı
 * kaldırır: yönetici uygulama içinden "📄 Yayınla" der, istek Supabase'deki
 * report_requests kuyruğuna yazılır (0008), bu betik 5 dakikada bir kuyruğu
 * boşaltır ve rapor repo'ya commit'lenir.
 *
 * YETKİ MODELİ (bilinçli):
 *   · Supabase'e YALNIZ OKUMA yapılır — anon anahtar (src/config/supabase.js).
 *     service_role anahtarı bu işte KULLANILMAZ: depoda/tarayıcıda duran bir
 *     süper anahtar tüm RLS'i anlamsızlaştırır.
 *   · Sonuç tabloya değil REPO'ya yazılır: rapor/yayin-kuyrugu.json. Git
 *     commit'i hem denetim izi hem yayın kanalıdır (Pages aynı dosyayı servis
 *     eder) → uygulama durumu oradan okur.
 *   · Bir isteğin işlendiği, günlükteki request_id ile anlaşılır; bu yüzden
 *     aynı istek iki kez rapor üretmez (cron çakışmasına karşı workflow'ta
 *     concurrency kilidi de var).
 *
 * 2026-10-03: report_requests.surface_snapshot doluysa yayın anında yeniden
 * LULC çalıştırılmaz. Sunucu-süzülmüş son kabul edilmiş alanlar data.json ve
 * rapor tablosuna dondurulur. Ayrıntılı kullanıcı çizim geometrisi kuyruğa
 * taşınmaz; dolayısıyla farklı bir raster haritası kabul edilmiş sayılarla
 * karıştırılmaz.
 *
 * GERİ ÇEKME (0010 · 2026-09-28): yayımlanmış raporlar yanlışlıkla
 * yayımlandığında 🗑 ile geri çekilir. report_retractions kuyruğu bu işte
 * işlenir: rapor dizinindeki VERİ dosyaları kaldırılır, adresinde gerekçeli
 * bildirim kalır (renderRetractionNotice), liste yenilenir ve günlük
 * 'Geri çekildi' kaydı alır. Kimlik (DGR) yeniden KULLANILMAZ. İstemcinin
 * beyan ettiği park_id ↔ report_id eşleşmesi GÜNLÜKLE doğrulanır: eşleşmeyen
 * satır işlenmez (RLS mülkiyeti park üzerinden verir, rapor eşlemesi burada).
 *
 * KULLANIM
 *   node scripts/publish-queue.mjs            (bekleyen istekleri işle)
 *   node scripts/publish-queue.mjs --dry      (planı yaz, üretme — prova)
 *   node scripts/publish-queue.mjs --limit 2  (tek koşuda en fazla 2 istek)
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishPark, renderRetractionNotice, rebuildIndex, DGR_ID_RE, renderReport, buildMetadata, qrDataUri, parkHistory } from './make-report.mjs';
import {createReportQueueApplication} from './lib/report-queue-application.mjs';
import {fetchUnprocessedRequests} from './lib/report-queue-pending-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

import {QUEUE_PATH, emptyQueue, loadQueue, saveQueue} from './lib/report-queue-store.mjs';
export {QUEUE_PATH, QUEUE_SCHEMA, QUEUE_CAP, emptyQueue, loadQueue, saveQueue} from './lib/report-queue-store.mjs';
import {RUN_LIMIT, createReportQueuePlanner} from './lib/report-queue-planning.mjs';
export {RUN_LIMIT, REQUEST_RETRY_MAX} from './lib/report-queue-planning.mjs';
export const {requestAttemptState, effectiveProcessedRequestIds, planQueue, planRetractions} = createReportQueuePlanner({isReportId: value => DGR_ID_RE.test(value)});

const SB = (() => {
  const s = read('src/config/supabase.js');
  return { url: s.match(/SB_URL="([^"]+)"/)[1], key: s.match(/SB_KEY="([^"]+)"/)[1] };
})();

/* ---------- istekler (Supabase, ANON anahtarla salt-okunur) ---------- */
async function fetchRequestRows(select, limit, offset=0, cutoff=null) {
  const u = SB.url + '/rest/v1/report_requests?' + new URLSearchParams({
    select,
    status: 'eq.Beklemede',
    order: 'created_at.asc',
    limit: String(limit),offset:String(offset),...(cutoff ? {created_at:"gte."+new Date(cutoff).toISOString()} : {}),
  });
  return reportRead(u, { headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key } });
}
export async function fetchPending(limit = 50, processedIds=[], cutoff=null) {
  return fetchUnprocessedRequests(fetchRequestRows, {limit, processedIds, cutoff});
}

/* ---------- geri çekme istekleri (0010; ANON anahtarla salt-okunur) ---------- */
export async function fetchPendingRetractions(limit = 50,processedIds=[],cutoff=null) {
 const out=[],done=new Set(processedIds.map(String));let offset=0;
 while(out.length<limit){
  const u=SB.url+'/rest/v1/report_retractions?'+new URLSearchParams({select:'id,report_id,park_id,reason,status,requested_by,created_at',status:'eq.Beklemede',order:'created_at.asc',limit:'50',offset:String(offset),...(cutoff?{created_at:'gte.'+new Date(cutoff).toISOString()}:{})});
  const r=await reportRead(u,{headers:{apikey:SB.key,Authorization:'Bearer '+SB.key}});
  if(r.status===404)return{rows:[],missing:true,message:'report_retractions tablosu yok — 0010_report_retraction.sql çalıştırılmalı'};
  if(!r.ok)throw Error('report_retractions HTTP '+r.status+': '+(await r.text()).slice(0,200));
  const rows=await r.json();if(!Array.isArray(rows))break;out.push(...rows.filter(r=>!done.has(String(r.id))));if(rows.length<50)break;offset+=rows.length;
 }
 return{rows:out.slice(0,limit),missing:false};
}

export {RETRACT_FILES} from './lib/report-retraction-workflow.mjs';
const application = createReportQueueApplication({
  root:ROOT,
  files:{readFileSync, writeFileSync, existsSync, unlinkSync},
  reports:{publishPark, renderRetractionNotice, rebuildIndex, DGR_ID_RE, renderReport, buildMetadata, qrDataUri, parkHistory},
  publicationOptions(req, {accepted, geometrySnapshot}) {
    const study=decodeReportContext(req.note);
    return { ...(study ? {study} : {}), skipLulc: accepted || (!geometrySnapshot && req.with_lulc === false), surfaceSnapshot: geometrySnapshot ? req.surface_snapshot : null };
  },
  async measureArchive(id) {
    const {readdirSync, statSync} = await import('node:fs');
    const dir = join(ROOT, 'rapor', id);
    return readdirSync(dir).reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
  },
  store:{RUN_LIMIT, QUEUE_PATH, loadQueue, saveQueue},
  planner:{effectiveProcessedRequestIds, planQueue, planRetractions},
  readers:{fetchPending, fetchPendingRetractions},
  log:message=>console.log(message)
});
export const {applyAcceptedSurfaceSnapshot, handleRetraction} = application;
const executeQueue = application.runQueue;
export function runQueue(opts = {}) {
  return executeQueue({...opts, limit: Number(opts.limit || arg('limit') || RUN_LIMIT), dry: opts.dry || has('dry')});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runQueue().catch((e) => { console.error('❌', (e && e.message) || e); process.exit(1); });
}
