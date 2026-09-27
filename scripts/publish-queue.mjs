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
 * KULLANIM
 *   node scripts/publish-queue.mjs            (bekleyen istekleri işle)
 *   node scripts/publish-queue.mjs --dry      (planı yaz, üretme — prova)
 *   node scripts/publish-queue.mjs --limit 2  (tek koşuda en fazla 2 istek)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishPark } from './make-report.mjs';

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

/* ---------- PLAN (saf fonksiyon: test burayı kilitler) ----------
 * Günlükte request_id'si zaten olan istekler ATLANIR (iki kez rapor üretmek
 * hem DGR kimliğini şişirir hem değişmezlik ilkesini bozar). */
export function planQueue(entries, requests, limit = RUN_LIMIT) {
  const done = new Set((entries || []).map((e) => String(e.request_id)));
  const todo = (requests || []).filter((r) => !done.has(String(r.id)));
  return { todo: todo.slice(0, limit), skipped: todo.length > limit ? todo.length - limit : 0, already: (requests || []).length - todo.length };
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
    return {
      ...base,
      status: 'Yayınlandı',
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
  if (!plan.todo.length) { console.log('✅ Üretilecek rapor yok.'); return { ok: true, processed: 0, entries: q.entries }; }
  if (dry) {
    for (const r of plan.todo) console.log(`   · (prova) park #${r.park_id} · istek ${r.id} · LULC ${r.with_lulc === false ? 'atlanacak' : 'dahil'}`);
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
      console.log(`     ${entry.url_path} · ${entry.report_hash.slice(0, 27)}…`);
    } else {
      fail++;
      console.log(`  ❌ üretilemedi: ${entry.message}`);
    }
    /* Günlük her istekten SONRA yazılır: koşu ortasında ölürse (zaman aşımı,
     * ağ) işlenmiş istek yeniden üretilmez. */
    saveQueue(q);
  }
  console.log(`\n📦 Kuyruk sonucu: ${ok} yayınlandı, ${fail} başarısız → ${QUEUE_PATH}`);
  return { ok: fail === 0, processed: ok + fail, published: ok, failed: fail, entries: q.entries };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runQueue().catch((e) => { console.error('❌', (e && e.message) || e); process.exit(1); });
}
