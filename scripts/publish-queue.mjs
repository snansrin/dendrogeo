#!/usr/bin/env node
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
import { canonicalHash } from './lib/mc.mjs';
import { acceptedSurfaceToLulc, stripUnavailableSurfaceMap, isAcceptedSurfaceSnapshot } from './lib/surface-snapshot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

export const QUEUE_PATH = 'rapor/yayin-kuyrugu.json';
export const QUEUE_SCHEMA = 'dendrogeo-publish-queue/1';
export const QUEUE_CAP = 200;
export const RUN_LIMIT = 3;

const SB = (() => {
  const s = read('src/config/supabase.js');
  return { url: s.match(/SB_URL="([^"]+)"/)[1], key: s.match(/SB_KEY="([^"]+)"/)[1] };
})();

/* ---------- günlük (repo tarafı, Pages ile yayınlanır) ---------- */
const qpath = (rel) => (String(rel).startsWith('/') ? String(rel) : join(ROOT, rel));
export function emptyQueue() {
  return { schema: QUEUE_SCHEMA, updated_at: null, entries: [] };
}
export function loadQueue(rel = QUEUE_PATH) {
  const p = qpath(rel);
  if (!existsSync(p)) return emptyQueue();
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    if (!j || j.schema !== QUEUE_SCHEMA || !Array.isArray(j.entries)) return emptyQueue();
    return j;
  } catch (e) { return emptyQueue(); }
}
export function saveQueue(q, rel = QUEUE_PATH) {
  const out = { ...q, ...(q.production_started_at ? {processed_request_ids:[...new Set([...(q.processed_request_ids||[]),...(q.entries||[]).filter(e=>e.request_id).map(e=>String(e.request_id))])],processed_retraction_ids:[...new Set([...(q.processed_retraction_ids||[]),...(q.entries||[]).filter(e=>e.retraction_id).map(e=>String(e.retraction_id))])]} : {}), schema: QUEUE_SCHEMA, updated_at: new Date().toISOString(), entries: (q.entries || []).slice(-QUEUE_CAP) };
  writeFileSync(qpath(rel), JSON.stringify(out, null, 2) + '\n');
  return out;
}

/* ---------- istekler (Supabase, ANON anahtarla salt-okunur) ---------- */
async function fetchRequestRows(select, limit, offset=0, cutoff=null) {
  const u = SB.url + '/rest/v1/report_requests?' + new URLSearchParams({
    select,
    status: 'eq.Beklemede',
    order: 'created_at.asc',
    limit: String(limit),offset:String(offset),...(cutoff ? {created_at:"gte."+new Date(cutoff).toISOString()} : {}),
  });
  return fetch(u, { headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key } });
}
export async function fetchPending(limit = 50, processedIds=[],cutoff=null) {
  const done=new Set(processedIds.map(String)),out=[];let offset=0,select='id,park_id,with_lulc,status,note,created_at,surface_snapshot';
  while(out.length<limit){
    let r=await fetchRequestRows(select,50,offset,cutoff);
    if(r.status===400){select='id,park_id,with_lulc,status,note,created_at';r=await fetchRequestRows(select,50,offset,cutoff);}
    if(r.status===404){const e=new Error('report_requests tablosu yok — Supabase SQL Editor\'da 0008_report_publish.sql çalıştırılmalı');e.code='NO_TABLE';throw e;}
    if(!r.ok)throw Error('report_requests HTTP '+r.status+': '+(await r.text()).slice(0,200));
    const rows=await r.json();if(!Array.isArray(rows))return out;
    out.push(...rows.filter(r=>!done.has(String(r.id))));if(rows.length<50)break;offset+=rows.length;
  }
  return out.slice(0,limit);
}

/* ---------- geri çekme istekleri (0010; ANON anahtarla salt-okunur) ---------- */
export async function fetchPendingRetractions(limit = 50,processedIds=[],cutoff=null) {
 const out=[],done=new Set(processedIds.map(String));let offset=0;
 while(out.length<limit){
  const u=SB.url+'/rest/v1/report_retractions?'+new URLSearchParams({select:'id,report_id,park_id,reason,status,requested_by,created_at',status:'eq.Beklemede',order:'created_at.asc',limit:'50',offset:String(offset),...(cutoff?{created_at:'gte.'+new Date(cutoff).toISOString()}:{})});
  const r=await fetch(u,{headers:{apikey:SB.key,Authorization:'Bearer '+SB.key}});
  if(r.status===404)return{rows:[],missing:true,message:'report_retractions tablosu yok — 0010_report_retraction.sql çalıştırılmalı'};
  if(!r.ok)throw Error('report_retractions HTTP '+r.status+': '+(await r.text()).slice(0,200));
  const rows=await r.json();if(!Array.isArray(rows))break;out.push(...rows.filter(r=>!done.has(String(r.id))));if(rows.length<50)break;offset+=rows.length;
 }
 return{rows:out.slice(0,limit),missing:false};
}

/* ---------- PLAN (saf fonksiyon: test burayı kilitler) ---------- */
export function planQueue(entries, requests, limit = RUN_LIMIT, processedIds = []) {
  const done = new Set([...(entries || []).map((e) => String(e.request_id)),...processedIds.map(String)]);
  const todo = (requests || []).filter((r) => !done.has(String(r.id)));
  return { todo: todo.slice(0, limit), skipped: todo.length > limit ? todo.length - limit : 0, already: (requests || []).length - todo.length };
}

export function planRetractions(entries, retractions, limit = RUN_LIMIT) {
  const done = new Set((entries || []).filter((e) => e.status === 'Geri çekildi').map((e) => String(e.retraction_id)));
  const retractedReports = new Set((entries || []).filter((e) => e.status === 'Geri çekildi').map((e) => String(e.report_id)));
  const pub = new Map();
  for (const e of entries || [])
    if (e.status === 'Yayınlandı' && DGR_ID_RE.test(String(e.report_id || ''))) pub.set(String(e.report_id), e);
  const valid = [], invalid = [];
  for (const rt of retractions || []) {
    if (!rt || !DGR_ID_RE.test(String(rt.report_id || ''))) { invalid.push(rt); continue; }
    if (done.has(String(rt.id))) continue;
    const p = pub.get(String(rt.report_id));
    if (!p || retractedReports.has(String(rt.report_id))) continue;
    if (Number(p.park_id) !== Number(rt.park_id)) { invalid.push(rt); continue; }
    valid.push(rt);
  }
  return { todo: valid.slice(0, limit), skipped: Math.max(0, valid.length - limit), invalid };
}

/* Kabul edilmiş yüzey sonucu, publishPark'in ürettiği normal snapshot üzerine
 * rapor kimliği değişmeden yeniden dondurulur. Bu aşama geometri açığa çıkarmaz. */
export async function applyAcceptedSurfaceSnapshot(pub, surfaceSnapshot, root = ROOT) {
  if (!isAcceptedSurfaceSnapshot(surfaceSnapshot)) return pub;
  const dir = join(root, 'rapor', String(pub.id));
  const dataPath = join(dir, 'data.json');
  if (!existsSync(dataPath)) throw new Error('Yayın snapshot dosyası bulunamadı: ' + pub.id);
  const snap = JSON.parse(readFileSync(dataPath, 'utf8'));
  const lulc = acceptedSurfaceToLulc(surfaceSnapshot, snap.park && snap.park.area_m2);
  if (!lulc) throw new Error('Kabul edilmiş yüzey snapshot alanları geçersiz veya boş.');

  snap.lulc = lulc;
  snap.provenance = {
    ...(snap.provenance || {}),
    dataset: lulc.source,
    epsg: null,
    surface_review: {
      schema: surfaceSnapshot.schema,
      revision: lulc.revision,
      accepted_at: lulc.accepted_at,
      source_fingerprint: lulc.source_fingerprint,
      object_fingerprint: lulc.object_fingerprint,
      geometry_published: false,
    },
  };
  const hash = canonicalHash(snap);
  const rapDir = join(root, 'rapor');
  const history = parkHistory(rapDir, snap.park.id, pub.id);
  const meta = {
    id: pub.id,
    git_commit: snap.provenance.git_commit || null,
    engine_version: snap.provenance.engine_version || null,
    app_version: snap.provenance.app_version || null,
    qr_uri: await qrDataUri(pub.url),
  };
  let html = renderReport(snap, { id: pub.id, hash, version: pub.version || 1, meta: { ...meta, history } });
  html = stripUnavailableSurfaceMap(html);
  writeFileSync(join(dir, 'index.html'), html);
  writeFileSync(dataPath, JSON.stringify(snap));
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(buildMetadata(snap, { id: pub.id, hash, version: '1.0', meta, history })) + '\n');
  try { unlinkSync(join(dir, 'harita.png')); } catch (e) { /* kabul snapshot'ında geometri yayımlanmaz */ }
  rebuildIndex(rapDir);
  return {
    ...pub,
    hash,
    lulc: `dahil (son kabul edilmiş yüzey kaydı · r${lulc.revision || '—'})`,
    surface_snapshot: true,
    surface_revision: lulc.revision,
    surface_accepted_at: lulc.accepted_at,
  };
}

/* ---------- tek isteğin işlenmesi ---------- */
async function handle(req) {
  const started = new Date().toISOString();
  const accepted = isAcceptedSurfaceSnapshot(req.surface_snapshot);
  const geometrySnapshot = req.surface_snapshot?.schema === "dendrogeo-surface/2";
  const base = {
    request_id: String(req.id), park_id: Number(req.park_id),
    with_lulc: req.with_lulc !== false,
    surface_snapshot: accepted || geometrySnapshot,
    requested_at: req.created_at || null, started_at: started,
  };
  try {
    /* Kabul edilmiş snapshot varsa yeniden LULC çalıştırma: önce hızlı temel
     * rapor iskeleti üretilir, sonra kabul edilmiş alanlar aynı DGR'ye bağlanır. */
    if(req.surface_snapshot && !accepted && !geometrySnapshot)throw new Error("Bilinmeyen kayıtlı analiz şeması");
    const study=decodeReportContext(req.note);
    let r = await publishPark(req.park_id, { ...(study ? {study} : {}), skipLulc: accepted || (!geometrySnapshot && req.with_lulc === false), surfaceSnapshot: geometrySnapshot ? req.surface_snapshot : null });
    if (accepted) r = await applyAcceptedSurfaceSnapshot(r, req.surface_snapshot);
    let bytes = null;
    try {
      const { readdirSync, statSync } = await import('node:fs');
      const d = join(fileURLToPath(new URL('..', import.meta.url)), 'rapor', r.id);
      bytes = readdirSync(d).reduce((a, f) => a + statSync(join(d, f)).size, 0);
    } catch (e) { /* boyut ölçümü yayın engeli değil */ }
    return {
      ...base,
      status: 'Yayınlandı',
      archive_bytes: bytes,
      report_id: r.id, version: r.version,
      url_path: '/rapor/' + r.id + '/',
      report_hash: 'sha256:' + r.hash,
      park_name: r.park_name, city: r.city, n: r.n,
      carbon_txt: r.carbon_txt, lulc: r.lulc, citation: r.citation,
      surface_revision: r.surface_revision || null,
      surface_accepted_at: r.surface_accepted_at || null,
      finished_at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ...base,
      status: 'Başarısız',
      message: String((e && e.message) || e).slice(0, 400),
      finished_at: new Date().toISOString(),
    };
  }
}

/* Geri çekmenin uygulanması: veri dosyaları silinir, index.html bildirime
 * döner, liste yenilenir. root parametrik (test geçici dizinde doğrular). */
export const RETRACT_FILES = ['rapor.pdf','doi-yayin-paketi.zip','manifest.json','zenodo-metadata.json','data.json', 'olcum.csv', 'park.geojson', 'surface.geojson', 'harita.png', 'metadata.json'];
export function handleRetraction(rt, pubEntry, root = ROOT) {
  const started = new Date().toISOString();
  const base = {
    retraction_id: String(rt.id), report_id: String(rt.report_id), park_id: Number(rt.park_id),
    park_name: (pubEntry && pubEntry.park_name) || null,
    reason: rt.reason ? String(rt.reason).slice(0, 400) : null,
    requested_by: rt.requested_by || null, requested_at: rt.created_at || null, started_at: started,
  };
  try {
    if (!DGR_ID_RE.test(base.report_id)) throw new Error('Geçersiz rapor kimliği: ' + base.report_id);
    const rapDir = join(root, 'rapor');
    const dir = join(rapDir, base.report_id);
    if (!dir.startsWith(rapDir) || !existsSync(dir)) throw new Error('Rapor dizini bulunamadı: ' + base.report_id);
    for (const f of RETRACT_FILES) { try { unlinkSync(join(dir, f)); } catch (e) { /* dosya zaten yok */ } }
    writeFileSync(join(dir, 'index.html'), renderRetractionNotice({
      id: base.report_id, parkName: base.park_name || '', reason: base.reason || '', retractedAt: new Date().toISOString(),
    }));
    rebuildIndex(rapDir);
    return { ...base, status: 'Geri çekildi', finished_at: new Date().toISOString() };
  } catch (e) {
    return { ...base, status: 'Geri çekme başarısız', message: String((e && e.message) || e).slice(0, 400), finished_at: new Date().toISOString() };
  }
}

/* ---------- ana akış ---------- */
export async function runQueue(opts = {}) {
  const limit = Number(opts.limit || arg('limit') || RUN_LIMIT);
  const dry = opts.dry || has('dry');
  const q = loadQueue();
  let requests = [];
  try {
    requests = await fetchPending(50,q.processed_request_ids||[],q.production_started_at||null);
  } catch (e) {
    console.log('⚠ Kuyruk okunamadı: ' + e.message);
    return { ok: false, processed: 0, entries: q.entries, reason: e.code || 'FETCH' };
  }
  const plan = planQueue(q.entries, requests, limit, q.processed_request_ids || []);
  console.log(`📄 Yayın kuyruğu: ${requests.length} bekleyen istek · ${plan.already} zaten işlenmiş · ${plan.todo.length} bu koşuda üretilecek${plan.skipped ? ` · ${plan.skipped} sonraki koşuya kaldı` : ''}`);

  let retractions = [], retMissing = false;
  try {
    const rr = await fetchPendingRetractions(50,q.processed_retraction_ids||[],q.production_started_at||null);
    retractions = rr.rows; retMissing = rr.missing;
  } catch (e) {
    console.log('⚠ Geri çekme kuyruğu okunamadı: ' + e.message);
  }
  const rplan = planRetractions(q.entries, retractions.filter(r=>!(q.processed_retraction_ids||[]).includes(String(r.id))), limit);
  if (!retMissing && (retractions.length || rplan.todo.length))
    console.log(`🗑 Geri çekme kuyruğu: ${retractions.length} bekleyen · ${rplan.todo.length} bu koşuda işlenecek${rplan.invalid.length ? ` · ${rplan.invalid.length} geçersiz/eşleşmeyen (İŞLENMEDİ)` : ''}`);

  if (!plan.todo.length && !rplan.todo.length) { console.log('✅ Üretilecek rapor yok, işlenecek geri çekme yok.'); return { ok: true, processed: 0, entries: q.entries }; }
  if (dry) {
    for (const r of plan.todo) {
      const mode=isAcceptedSurfaceSnapshot(r.surface_snapshot)?'son kabul edilmiş yüzey snapshotı':(r.with_lulc===false?'LULC atlanacak':'LULC dahil');
      console.log(`   · (prova) park #${r.park_id} · istek ${r.id} · ${mode}`);
    }
    for (const r of rplan.todo) console.log(`   · (prova) geri çekme ${r.id} · ${r.report_id}`);
    return { ok: true, processed: 0, dry: true, entries: q.entries };
  }
  let ok = 0, fail = 0;
  for (const r of plan.todo) {
    const mode=isAcceptedSurfaceSnapshot(r.surface_snapshot)?'kabul edilmiş yüzey snapshotı':(r.with_lulc===false?'LULC atlandı':'LULC dahil');
    console.log(`\n▶ park #${r.park_id} (istek ${r.id}) · ${mode}`);
    const entry = await handle(r);
    q.entries.push(entry);
    if (entry.status === 'Yayınlandı') {
      ok++;
      console.log(`  ✅ ${entry.report_id} · n=${entry.n} · ${entry.carbon_txt}`);
      console.log(`     ${entry.url_path} · ${entry.report_hash.slice(0, 27)}…${entry.archive_bytes ? ' · arşiv ' + (entry.archive_bytes / 1024).toFixed(0) + ' KB' : ''}`);
    } else {
      fail++;
      console.log(`  ❌ üretilemedi: ${entry.message}`);
    }
    saveQueue(q);
  }

  let retOk = 0, retFail = 0;
  for (const rt of rplan.todo) {
    console.log(`\n🗑 geri çekme ${rt.id} · ${rt.report_id}`);
    const pubEntry = q.entries.find((e) => e.status === 'Yayınlandı' && String(e.report_id) === String(rt.report_id)) || null;
    const entry = handleRetraction(rt, pubEntry);
    q.entries.push(entry);
    if (entry.status === 'Geri çekildi') { retOk++; console.log(`  ✅ ${entry.report_id} yayından kaldırıldı (bildirim yerinde, listeden düştü)`); }
    else { retFail++; console.log(`  ❌ geri çekilemedi: ${entry.message}`); }
    saveQueue(q);
  }

  console.log(`\n📦 Kuyruk sonucu: ${ok} yayınlandı, ${fail} başarısız, ${retOk} geri çekildi, ${retFail} geri çekme başarısız → ${QUEUE_PATH}`);
  return { ok: fail === 0 && retFail === 0, processed: ok + fail + retOk + retFail, published: ok, failed: fail, retracted: retOk, retractFailed: retFail, entries: q.entries };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runQueue().catch((e) => { console.error('❌', (e && e.message) || e); process.exit(1); });
}
