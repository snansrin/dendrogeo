#!/usr/bin/env node
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
import { publishPark, renderRetractionNotice, rebuildIndex, DGR_ID_RE } from './make-report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

export const QUEUE_PATH = 'rapor/yayin-kuyrugu.json';
export const QUEUE_SCHEMA = 'dendrogeo-publish-queue/1';
export const QUEUE_CAP = 200;          /* günlük sınırsız büyümesin */
export const RUN_LIMIT = 3;            /* tek koşuda en fazla bu kadar rapor */

const SB = (() => {
  const s = read('src/config/supabase.js');
  return { url: s.match(/SB_URL="([^"]+)"/)[1], key: s.match(/SB_KEY="([^"]+)"/)[1] };
})();

/* ---------- günlük (repo tarafı, Pages ile yayınlanır) ---------- */
/* rel: depo göreli yol (varsayılan QUEUE_PATH) veya mutlak yol — testler
 * geçici dizine yazabilsin diye. */
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
  const out = { schema: QUEUE_SCHEMA, updated_at: new Date().toISOString(), entries: (q.entries || []).slice(-QUEUE_CAP) };
  writeFileSync(qpath(rel), JSON.stringify(out, null, 2) + '\n');
  return out;
}

/* ---------- istekler (Supabase, ANON anahtarla salt-okunur) ---------- */
export async function fetchPending(limit = 50) {
  const u = SB.url + '/rest/v1/report_requests?' + new URLSearchParams({
    select: 'id,park_id,with_lulc,status,note,created_at',
    status: 'eq.Beklemede',
    order: 'created_at.asc',
    limit: String(limit),
  });
  const r = await fetch(u, { headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key } });
  if (r.status === 404) { const e = new Error('report_requests tablosu yok — Supabase SQL Editor\'da 0008_report_publish.sql çalıştırılmalı'); e.code = 'NO_TABLE'; throw e; }
  if (!r.ok) throw new Error('report_requests HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

/* ---------- geri çekme istekleri (0010; ANON anahtarla salt-okunur) ---------- */
export async function fetchPendingRetractions(limit = 50) {
  const u = SB.url + '/rest/v1/report_retractions?' + new URLSearchParams({
    select: 'id,report_id,park_id,reason,status,requested_by,created_at',
    status: 'eq.Beklemede',
    order: 'created_at.asc',
    limit: String(limit),
  });
  const r = await fetch(u, { headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key } });
  if (r.status === 404) { const e = new Error('report_retractions tablosu yok — Supabase SQL Editor\'da 0010_report_retraction.sql çalıştırılmalı'); e.code = 'NO_TABLE'; return { rows: [], missing: true, message: e.message }; }
  if (!r.ok) throw new Error('report_retractions HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  return { rows: Array.isArray(rows) ? rows : [], missing: false };
}

/* ---------- PLAN (saf fonksiyon: test burayı kilitler) ----------
 * Günlükte request_id'si zaten olan istekler ATLANIR (iki kez rapor üretmek
 * hem DGR kimliğini şişirir hem değişmezlik ilkesini bozar). */
export function planQueue(entries, requests, limit = RUN_LIMIT) {
  const done = new Set((entries || []).map((e) => String(e.request_id)));
  const todo = (requests || []).filter((r) => !done.has(String(r.id)));
  return { todo: todo.slice(0, limit), skipped: todo.length > limit ? todo.length - limit : 0, already: (requests || []).length - todo.length };
}

/* Geri çekme planı (saf):
 *  · günlükte retraction_id'si olan istek ATLANIR (yeniden işlenmez),
 *  · report_id günlükte 'Yayınlandı' olarak YOKSA işlenmez (uydurma kimlik),
 *  · aynı rapor zaten geri çekilmişse işlenmez,
 *  · istekteki park_id, günlüğün yayın kaydıyla EŞLEŞMİYORSA işlenmez
 *    (istemci beyanına güvenilmez; RLS park mülkiyetine bakar, eşleme burada). */
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

/* ---------- tek isteğin işlenmesi ---------- */
async function handle(req) {
  const started = new Date().toISOString();
  const base = {
    request_id: String(req.id), park_id: Number(req.park_id),
    with_lulc: req.with_lulc !== false,
    requested_at: req.created_at || null, started_at: started,
  };
  try {
    const r = await publishPark(req.park_id, { skipLulc: req.with_lulc === false });
    /* Arşiv boyutu (0012 · "proje fazla yer kaplamasın"): her yayının bayt
     * büyüklüğü günlüğe işlenir → depo bütçesi izlenebilir. */
    let bytes = null;
    try {
      const { readdirSync, statSync } = await import('node:fs');
      const { join } = await import('node:path');
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
 * döner, liste yenilenir. root parametrik (test geçici dizinde doğrular).
 * Yol GÜVENLİĞİ: report_id biçimi yeniden doğrulanır ve hedef dizin rapor
 * kökünün dışına çıkamaz (resolve + prefix kontrolü). */
export const RETRACT_FILES = ['data.json', 'olcum.csv', 'park.geojson', 'harita.png', 'metadata.json'];
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
    requests = await fetchPending();
  } catch (e) {
    /* Tablo yoksa (0008 uygulanmamış) ya da ağ hatası: iş DURUR ama koşu
     * başarısız sayılmaz — cron her 5 dakikada bir yeniden dener. */
    console.log('⚠ Kuyruk okunamadı: ' + e.message);
    return { ok: false, processed: 0, entries: q.entries, reason: e.code || 'FETCH' };
  }
  const plan = planQueue(q.entries, requests, limit);
  console.log(`📄 Yayın kuyruğu: ${requests.length} bekleyen istek · ${plan.already} zaten işlenmiş · ${plan.todo.length} bu koşuda üretilecek${plan.skipped ? ` · ${plan.skipped} sonraki koşuya kaldı` : ''}`);

  /* ---- geri çekme kuyruğu (0010): yayın fazından bağımsız okunur ---- */
  let retractions = [], retMissing = false;
  try {
    const rr = await fetchPendingRetractions();
    retractions = rr.rows; retMissing = rr.missing;
  } catch (e) {
    console.log('⚠ Geri çekme kuyruğu okunamadı: ' + e.message);
  }
  const rplan = planRetractions(q.entries, retractions, limit);
  if (!retMissing && (retractions.length || rplan.todo.length))
    console.log(`🗑 Geri çekme kuyruğu: ${retractions.length} bekleyen · ${rplan.todo.length} bu koşuda işlenecek${rplan.invalid.length ? ` · ${rplan.invalid.length} geçersiz/eşleşmeyen (İŞLENMEDİ)` : ''}`);

  if (!plan.todo.length && !rplan.todo.length) { console.log('✅ Üretilecek rapor yok, işlenecek geri çekme yok.'); return { ok: true, processed: 0, entries: q.entries }; }
  if (dry) {
    for (const r of plan.todo) console.log(`   · (prova) park #${r.park_id} · istek ${r.id} · LULC ${r.with_lulc === false ? 'atlanacak' : 'dahil'}`);
    for (const r of rplan.todo) console.log(`   · (prova) geri çekme ${r.id} · ${r.report_id}`);
    return { ok: true, processed: 0, dry: true, entries: q.entries };
  }
  let ok = 0, fail = 0;
  for (const r of plan.todo) {
    console.log(`\n▶ park #${r.park_id} (istek ${r.id}) · LULC ${r.with_lulc === false ? 'atlandı' : 'dahil'}`);
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
    /* Günlük her istekten SONRA yazılır: koşu ortasında ölürse (zaman aşımı,
     * ağ) işlenmiş istek yeniden üretilmez. */
    saveQueue(q);
  }

  /* ---- geri çekmeleri uygula: veri dosyaları kalkar, bildirim + günlük kalır ---- */
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
