/* retraction.test.mjs — 🗑 GERİ ÇEKME hattı bekçileri (0010 · 2026-09-28)
 *
 * KULLANICI İSTEĞİ: "yönetici kısmına yayınları silme yetkisi ver,
 * yanlışlıkla yayınlananların silinmesine izin ver; kullanıcıya da aynı
 * şekilde." → bilimsel çizgi: SESSİZ SİLME YOK, geri çekme (retraction):
 * veri dosyaları kalkar, adreste gerekçeli bildirim kalır, kimlik yeniden
 * kullanılmaz, işlem günlüğe + git geçmişine yazılır.
 *
 * Kilitlenen üç ayak:
 *   1) SQL (0010): biçim/kimlik/aktiflik/mülkiyet/kota/yineleme kilitleri,
 *      select anon (Actions okur), update YOK, delete yalnız yönetici.
 *   2) KUYRUK: planRetractions (günlükle park eşleşme doğrulaması — istemci
 *      beyanına güvenilmez), handleRetraction (geçici dizinde dosya işleyici,
 *      yol enjeksiyonu reddi), bildirim sayfası (noindex, kaçışlama, veri
 *      bağlantısı yok), rebuildIndex düşürme.
 *   3) İSTEMCİ (vm): 🗑 düğmeleri (yönetici kartı + kullanıcı paneli), durum
 *      rozetleri, geri çekilen raporun bağlantı ÜRETMEMESİ, insert gövdesi +
 *      oturum anahtarı, hata eşlemeleri, sınıf allowlist (yeni CSS yok).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { planRetractions, handleRetraction, RETRACT_FILES } from '../scripts/publish-queue.mjs';
import { renderRetractionNotice } from '../scripts/make-report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SQL = read('supabase/migrations/0010_report_retraction.sql');
const UI = read('src/services/report-publish.js');
const PQ = read('scripts/publish-queue.mjs');
const WF = read('.github/workflows/rapor-yayin.yml');
const DOCS = read('docs/rapor-yayini.md');

/* ============================================================ 1) SQL */
describe('0010: geri çekme yetki modeli (SQL)', () => {
  test('tablo: kapalı status kümesi + istek kaydı değişmez alanlar', () => {
    assert.match(SQL, /create table if not exists public\.report_retractions/);
    assert.match(SQL, /report_id\s+text not null/);
    assert.match(SQL, /check \(status in \('Beklemede'\)\)/, 'sonuç DB’ye yazılamaz (0008 ilkesi)');
    assert.match(SQL, /requested_by uuid not null default auth\.uid\(\)/);
  });
  test('⭐ biçim kilidi: report_id yalnız DGR-YYYY-NNNN (yol enjeksiyonu yok)', () => {
    assert.match(SQL, /report_id !~ '\^DGR-\[0-9\]\{4\}-\[0-9\]\{4\}\$'/);
    assert.match(SQL, /RETRACT_BAD_ID \(DGR0RF\)/);
    assert.match(SQL, /errcode = 'DG0RF'/);
  });
  test('⭐ kimlik + mülkiyet: kendi adına, kendi parkının yayını', () => {
    assert.match(SQL, /new\.requested_by is distinct from auth\.uid\(\)/);
    assert.match(SQL, /RETRACT_NOT_SELF \(DGR0RN\)/);
    assert.match(SQL, /p\.owner = auth\.uid\(\)\s+and p\.park_id = new\.park_id/);
    assert.match(SQL, /RETRACT_NOT_YOUR_PARK \(DGR0RP\)/);
  });
  test('⭐ kota + yineleme + aktiflik', () => {
    assert.match(SQL, /quota constant int := 3/);
    assert.match(SQL, /RETRACT_QUOTA \(DGR0RQ\)/);
    assert.match(SQL, /RETRACT_DUPLICATE \(DGR0RD\)/);
    assert.match(SQL, /public\.is_active\(\)/);
    assert.match(SQL, /create unique index if not exists uq_report_retraction_pending\s+on public\.report_retractions \(report_id\)\s+where status = 'Beklemede'/);
  });
  test('RLS: select anon+authenticated, insert çifte koşullu, UPDATE YOK, delete yönetici', () => {
    assert.match(SQL, /alter table public\.report_retractions enable row level security/);
    assert.match(SQL, /create policy report_retractions_select on public\.report_retractions\s+for select to anon, authenticated\s+using \(true\)/);
    assert.match(SQL, /create policy report_retractions_insert on public\.report_retractions\s+for insert to authenticated\s+with check \(\s+requested_by = auth\.uid\(\)/);
    assert.match(SQL, /public\.is_admin\(\)\s+or \(/, 'yönetici VEYA park sahibi');
    assert.ok(!/for update/.test(SQL), 'istek kaydı değiştirilemez (denetim izi)');
    assert.match(SQL, /create policy report_retractions_delete on public\.report_retractions\s+for delete to authenticated\s+using \(public\.is_admin\(\)\)/);
  });
  test('grants + idempotent yapı', () => {
    assert.match(SQL, /grant select on public\.report_retractions to anon, authenticated/);
    assert.match(SQL, /grant insert, delete on public\.report_retractions to authenticated/);
    assert.match(SQL, /^begin;/m); assert.match(SQL, /^commit;/m);
    assert.match(SQL, /create or replace function public\.tg_report_retraction_gate\(\)/);
    assert.ok((SQL.match(/drop policy if exists/g) || []).length >= 3);
    assert.match(SQL, /drop trigger if exists trg_report_retraction_gate/);
  });
  test('dokümantasyon zinciri tamam', () => {
    assert.match(read('supabase/README.md'), /0010_report_retraction\.sql/);
    assert.match(read('supabase/README.md'), /10\. `0010_report_retraction\.sql` → Run/);
    assert.match(DOCS, /4b\) Geri çekme/);
    assert.match(DOCS, /RETRACT_NOT_YOUR_PARK/);
    assert.match(DOCS, /DendroGeo Bilimsel Analiz Raporu/, 'DGR tanımı rehberde');
    assert.match(DOCS, /6b\) Rapor şablonu v2/);
    assert.match(WF, /GERİ ÇEKME \(0010/, 'workflow belgelenmesi');
    assert.match(WF, /report_retractions/);
  });
});

/* ============================================================ 2) KUYRUK */
describe('publish-queue: geri çekme planı (günlükle doğrulama)', () => {
  const PUB = (rid, park, reqId) => ({ status: 'Yayınlandı', report_id: rid, park_id: park, request_id: reqId, park_name: 'P' + park });
  const RET = (rid, park) => ({ status: 'Geri çekildi', report_id: rid, park_id: park, retraction_id: 'ret-done' });
  const RT = (id, rid, park) => ({ id, report_id: rid, park_id: park, status: 'Beklemede', reason: null, created_at: '2026-09-28T10:00:00Z' });

  test('geçerli istek planlanır; işlenmiş/bilinmeyen/eldevar olan atlanır', () => {
    const entries = [PUB('DGR-2026-0001', 5, 'r1'), PUB('DGR-2026-0002', 6, 'r2'), RET('DGR-2026-0002', 6)];
    const plan = planRetractions(entries, [
      RT('ret-done', 'DGR-2026-0002', 6),          /* günlükte işlenmiş → atla */
      RT('ret-a', 'DGR-2026-0001', 5),             /* geçerli */
      RT('ret-b', 'DGR-2026-0002', 6),             /* zaten geri çekilmiş → atla */
      RT('ret-c', 'DGR-2026-0003', 5),             /* günlükte yayın kaydı yok → atla */
    ], 5);
    assert.deepEqual(plan.todo.map((r) => r.id), ['ret-a']);
  });
  test('⭐ park eşleşmeyen istek İŞLENMEZ (istemci beyanına güven yok)', () => {
    const entries = [PUB('DGR-2026-0001', 5, 'r1')];
    const plan = planRetractions(entries, [RT('ret-x', 'DGR-2026-0001', 9)], 5);
    assert.equal(plan.todo.length, 0);
    assert.deepEqual(plan.invalid.map((r) => r.id), ['ret-x']);
  });
  test('bozuk kimlik biçimi invalid’e düşer (javascript:, yol denemesi)', () => {
    const entries = [PUB('DGR-2026-0001', 5, 'r1')];
    const plan = planRetractions(entries, [RT('ret-j', 'javascript:alert(1)', 5), RT('ret-p', 'DGR-2026-0001/../../x', 5)], 5);
    assert.equal(plan.todo.length, 0);
    assert.equal(plan.invalid.length, 2);
  });
  test('limit sonraki koşuya bırakır', () => {
    const entries = [PUB('DGR-2026-0001', 5, 'r1'), PUB('DGR-2026-0003', 5, 'r3'), PUB('DGR-2026-0004', 5, 'r4')];
    const plan = planRetractions(entries, [RT('a', 'DGR-2026-0001', 5), RT('b', 'DGR-2026-0003', 5), RT('c', 'DGR-2026-0004', 5)], 2);
    assert.equal(plan.todo.length, 2);
    assert.equal(plan.skipped, 1);
  });
  test('kaynak kilitleri: anon okuma + bildirim + liste yenileme', () => {
    assert.match(PQ, /rest\/v1\/report_retractions/, 'anon REST okuması');
    /* 0059 (fix/surface-report-field-ux): kilit AMACINI korur, biçimini
     * gevşetir — çekirdek dört ad make-report.mjs'ten import edilmeli
     * (satır içi yeniden yazım yasak) ama yayın hattı yeni adlar
     * ekleyebilir (surface-snapshot entegrasyonu renderReport/buildMetadata/
     * qrDataUri/parkHistory getirdi). Birebir satır eşleşmesi yerine
     * ad-bazlı denetim: amaç aynı, genişleme serbest. */
    const imp = PQ.match(/import \{([^}]*)\} from '\.\/make-report\.mjs';/);
    assert.ok(imp, 'publish-queue make-report.mjs import satırı bulunamadı');
    for (const n of ['publishPark', 'renderRetractionNotice', 'rebuildIndex', 'DGR_ID_RE']) {
      assert.ok(imp[1].split(',').map(x => x.trim()).includes(n), 'çekirdek import eksik: ' + n);
    }
    assert.match(PQ, /service_role/, 'yasak anahtar yalnız yorumda geçer');
    assert.ok(!/process\.env\.SUPABASE_SERVICE/.test(PQ));
    assert.deepEqual(RETRACT_FILES, ['data.json', 'olcum.csv', 'park.geojson', 'surface.geojson', 'harita.png', 'metadata.json']);
  });
});

describe('publish-queue: handleRetraction (geçici dizinde gerçek işleyici)', () => {
  const mkTmp = () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dgr-ret-'));
    const rap = join(tmp, 'rapor');
    mkdirSync(join(rap, 'DGR-2026-0009'), { recursive: true });
    mkdirSync(join(rap, 'DGR-2026-0008'), { recursive: true });
    for (const f of RETRACT_FILES) writeFileSync(join(rap, 'DGR-2026-0009', f), 'x');
    writeFileSync(join(rap, 'DGR-2026-0009', 'index.html'), '<html>rapor</html>');
    writeFileSync(join(rap, 'DGR-2026-0008', 'data.json'), JSON.stringify({ park: { name: 'Komşu Parkı' }, totals: { n: 1, ci: { mean: 1, lo: 0.5, hi: 2 } }, generated_at: '2026-09-27T10:00:00Z' }));
    writeFileSync(join(rap, 'DGR-2026-0008', 'index.html'), '<html>komşu</html>');
    return tmp;
  };
  test('veri dosyaları silinir, bildirim yazılır, listeden düşer, günlük kaydı doğru', () => {
    const tmp = mkTmp();
    const e = handleRetraction({ id: 'ret-1', report_id: 'DGR-2026-0009', park_id: 5, reason: 'yanlışlıkla yayınlandı <script>alert(1)</script>', requested_by: 'u-1', created_at: '2026-09-28T10:00:00Z' }, { park_name: 'Deneme Parkı' }, tmp);
    assert.equal(e.status, 'Geri çekildi');
    assert.equal(e.report_id, 'DGR-2026-0009');
    const d = join(tmp, 'rapor', 'DGR-2026-0009');
    for (const f of RETRACT_FILES) assert.ok(!existsSync(join(d, f)), f + ' silindi');
    const notice = readFileSync(join(d, 'index.html'), 'utf8');
    assert.match(notice, /Bu rapor geri çekilmiştir/);
    assert.match(notice, /DGR-2026-0009/);
    assert.match(notice, /Deneme Parkı/);
    assert.ok(!/<script>alert/.test(notice), 'gerekçe kaçışlanır');
    assert.match(notice, /&lt;script&gt;/);
    assert.match(notice, /noindex/, 'arama motoruna düşmez');
    assert.ok(!/href="data\.json"|href="olcum\.csv"|href="harita\.png"/.test(notice), 'veri bağlantısı yok');
    assert.match(notice, /yeniden kullanılmaz/);
    const idx = readFileSync(join(tmp, 'rapor', 'index.html'), 'utf8');
    assert.match(idx, /DGR-2026-0008/, 'geçerli rapor listede');
    assert.ok(!idx.includes('DGR-2026-0009/'), 'geri çekilen listeden düştü');
  });
  test('⭐ yol enjeksiyonu: kimlik biçimi bozuksa dosyaya dokunulmaz', () => {
    const tmp = mkTmp();
    const e = handleRetraction({ id: 'ret-2', report_id: 'DGR-2026-0009/../../etc', park_id: 5 }, null, tmp);
    assert.equal(e.status, 'Geri çekme başarısız');
    assert.ok(existsSync(join(tmp, 'rapor', 'DGR-2026-0009', 'data.json')), 'orijinal yerinde');
  });
  test('dizin yoksa başarısız kaydı (sessiz başarı yok)', () => {
    const tmp = mkTmp();
    const e = handleRetraction({ id: 'ret-3', report_id: 'DGR-2026-0077', park_id: 5 }, null, tmp);
    assert.equal(e.status, 'Geri çekme başarısız');
    assert.match(e.message, /bulunamadı/);
  });
  test('bildirim üreticisi: reason boşsa dürüst varsayılan', () => {
    const n = renderRetractionNotice({ id: 'DGR-2026-0009', parkName: 'P', reason: '', retractedAt: '2026-09-28T10:00:00Z' });
    assert.match(n, /Gerekçe belirtilmedi\./);
    assert.match(n, /yayin-kuyrugu\.json/, 'denetim izi adresi');
  });
});

/* ============================================================ 3) İSTEMCİ */
function bootRet(opts) {
  const o = opts || {};
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', style: {}, checked: true, classList: { contains: () => true }, scrollIntoView() {} });
  for (const id of ['dgPubBox', 'dgPubClock', 'dgPubLulc', 'v-admin', 'dgUserPubBox', 'dgUserPubLulc', 'v-projects']) el(id);
  const toasts = [], fetches = [], prompts = [];
  const RESULTS = {
    report_requests: { data: o.requests || [], error: null },
    report_retractions: { data: o.retractions || [], error: o.retError || null },
    measurements: { count: 2 },
    v_park_compare: { data: o.parks || [], error: null },
  };
  const chain = (table) => {
    const t = { then: (res) => res(RESULTS[table] || { data: [], error: null }) };
    for (const m of ['select', 'eq', 'order', 'limit', 'is', 'update', 'insert']) t[m] = () => t;
    return t;
  };
  let QUEUE = o.queue || { schema: 'dendrogeo-publish-queue/1', entries: [] };
  let POST = o.post || { status: 201, text: '' };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: (id) => els[id] || null, hidden: false, querySelector: () => null },
    navigator: { clipboard: { writeText: async () => {} } },
    location: { href: 'https://dendrogeo.org/' },
    window: null,
    SB_URL: 'https://x.supabase.co', SB_KEY: 'anon-key',
    PROFILE: o.profile || { id: 'u1', role: 'owner' },
    USER: o.user === undefined ? { id: 'u1' } : o.user,
    PROJ_LIST: o.projects || [{ id: 11, park_id: 6, parks: { name: 'Göksu Parkı' }, name: 'Göksu Parkı - deneme' }],
    toast: (m, t) => toasts.push([m, t]),
    confirm: () => o.confirm !== false,
    prompt: (msg, dflt) => { prompts.push([msg, dflt]); return o.prompt === undefined ? 'yanlışlıkla yayınlandı' : o.prompt; },
    sb: { from: (table) => chain(table), auth: { getSession: async () => ({ data: { session: { access_token: 'tok-1' } } }) } },
    fetch: async (u, op) => {
      const m = (op && op.method) || 'GET';
      if (m === 'POST') { fetches.push({ url: u, headers: op.headers, body: JSON.parse(op.body) }); return { ok: POST.status < 300, status: POST.status, text: async () => POST.text }; }
      if (/report_retractions/.test(String(u)) && m === 'GET') return { ok: true, status: 200, json: async () => (o.retRows || []), text: async () => '' };
      return { ok: true, status: 200, json: async () => QUEUE, text: async () => '' };
    },
    setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 0,
    URL, URLSearchParams, Math, JSON, Date, Number, Array, Object, String, Boolean, RegExp, Error, Promise, Intl,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('src/config/constants.js'), ctx, { filename: 'constants.js' });
  vm.runInContext(UI, ctx, { filename: 'report-publish.js' });
  const run = (code) => vm.runInContext(code, ctx);
  return {
    ctx, els, toasts, fetches, prompts, run,
    setPost: (p) => { POST = p; },
    setState: (patch) => run('Object.assign(DG_PUB_STATE,' + JSON.stringify(patch) + ')'),
    adminHtml: () => els.dgPubBox.innerHTML,
    userHtml: () => els.dgUserPubBox.innerHTML,
    lastToast: () => toasts[toasts.length - 1],
  };
}
const PARK = { park_id: 5, park_name: 'A Parkı', city: 'Ankara', records: 2, carbon_kg: 24000, species_n: 2, contributors: 1, area_m2: 852000 };
const QE = (rid, park, extra) => Object.assign({ request_id: 'r1', park_id: park, status: 'Yayınlandı', report_id: rid, park_name: 'A Parkı', n: 2, carbon_txt: '24 t', finished_at: '2026-09-27T12:00:00Z' }, extra || {});

describe('istemci: yönetici kartı 🗑 (vm)', () => {
  test('yayınlandı satırında 🔗 + 📤 + 🗑 + 📄 Yeni sürüm bir arada', () => {
    const ui = bootRet({ parks: [PARK] });
    ui.setState({ parks: [PARK], requests: [], retractions: [], queue: { schema: 'x', entries: [QE('DGR-2026-0002', 5)] }, error: '' });
    ui.run('dgPubRender()');
    const h = ui.adminHtml();
    assert.match(h, /badge on">Yayınlandı/);
    assert.match(h, /dgReportRetract\('DGR-2026-0002',5\)/, '🗑 düğmesi kimlik+park ile');
    assert.match(h, /🗑 Geri çek/);
    assert.match(h, /dgReportOpen\('DGR-2026-0002'\)/);
    assert.match(h, /📄 Yeni sürüm/);
  });
  test('⭐ geri çekilen rapor: rozet döner, BAĞLANTI ÜRETİLMEZ', () => {
    const ui = bootRet({ parks: [PARK] });
    ui.setState({
      parks: [PARK], requests: [], retractions: [], error: '',
      queue: { schema: 'x', entries: [QE('DGR-2026-0002', 5), { status: 'Geri çekildi', report_id: 'DGR-2026-0002', park_id: 5, retraction_id: 'ret-1', reason: 'kazayla', finished_at: '2026-09-28T09:00:00Z' }] },
    });
    ui.run('dgPubRender()');
    const h = ui.adminHtml();
    assert.match(h, /badge off">Geri çekildi/);
    assert.match(h, /kazayla/, 'gerekçe görünür');
    assert.ok(!h.includes('https://dendrogeo.org/rapor/DGR-2026-0002/'), 'bağlantı yok');
    assert.ok(!/dgReportRetract/.test(h), 'zaten çekilmişe ikinci 🗑 yok');
    assert.match(h, /onclick="dgPublishReport\(5\)"/, 'yeni DGR yolu açık');
    assert.equal(ui.run('dgPubPublishedInPark(DG_PUB_STATE.queue,5)'), null, 'saf filtre: yayınlanmış sayılmaz');
    assert.match(ui.run('dgPubRetractedInPark(DG_PUB_STATE.queue,5).report_id'), /DGR-2026-0002/);
  });
  test('bekleyen geri çekme: rozet "Geri çekiliyor", 🗑/📄 gizli', () => {
    const ui = bootRet({ parks: [PARK] });
    ui.setState({
      parks: [PARK], requests: [], error: '',
      retractions: [{ id: 'ret-1', report_id: 'DGR-2026-0002', park_id: 5, status: 'Beklemede', created_at: new Date().toISOString() }],
      queue: { schema: 'x', entries: [QE('DGR-2026-0002', 5)] },
    });
    ui.run('dgPubRender()');
    const h = ui.adminHtml();
    assert.match(h, /badge admin">Geri çekiliyor/);
    assert.ok(!/dgReportRetract/.test(h), 'ikinci istek düğmesi yok');
    assert.ok(!/onclick="dgPublishReport/.test(h), 'kuyruk varken yeni yayın düğmesi yok');
  });
  test('günlük şeridi geri çekmeyi 🗑 ile gösterir', () => {
    const ui = bootRet({ parks: [PARK] });
    ui.setState({ parks: [PARK], requests: [], retractions: [], error: '', queue: { schema: 'x', entries: [QE('DGR-2026-0002', 5), { status: 'Geri çekildi', report_id: 'DGR-2026-0002', park_id: 5, retraction_id: 'ret-9', reason: 'kazayla', finished_at: '2026-09-28T09:00:00Z' }] } });
    ui.run('dgPubRender()');
    assert.match(ui.adminHtml(), /🗑 <b>DGR-2026-0002<\/b> geri çekildi/);
  });
});

describe('istemci: dgReportRetract davranışı (vm)', () => {
  test('⭐ insert gövdesi + oturum anahtarı + return=minimal', async () => {
    const ui = bootRet({ parks: [PARK] });
    await ui.run('dgReportRetract("DGR-2026-0002",5)');
    assert.equal(ui.fetches.length, 1);
    const f = ui.fetches[0];
    assert.match(f.url, /\/rest\/v1\/report_retractions$/);
    assert.equal(f.headers['Authorization'], 'Bearer tok-1');
    assert.equal(f.headers['Prefer'], 'return=minimal');
    assert.deepEqual(f.body, [{ report_id: 'DGR-2026-0002', park_id: 5, reason: 'yanlışlıkla yayınlandı', status: 'Beklemede', requested_by: 'u1' }]);
    assert.match(ui.lastToast()[0], /kuyruğa alındı/);
  });
  test('geçersiz kimlik ve oturumsuz çağrı reddedilir (fetch bile atılmaz)', async () => {
    const ui = bootRet({});
    await ui.run('dgReportRetract("javascript:alert(1)",5)');
    assert.match(ui.lastToast()[0], /geçersiz/i);
    assert.equal(ui.fetches.length, 0);
    const ui2 = bootRet({ user: null });
    await ui2.run('dgReportRetract("DGR-2026-0002",5)');
    assert.match(ui2.lastToast()[0], /giriş yap/i);
    assert.equal(ui2.fetches.length, 0);
  });
  test('confirm iptali fetch atmaz; gerekçe 400 karaktere kırpılır', async () => {
    const ui = bootRet({ confirm: false });
    await ui.run('dgReportRetract("DGR-2026-0002",5)');
    assert.equal(ui.fetches.length, 0);
    const ui2 = bootRet({ prompt: 'x'.repeat(900) });
    await ui2.run('dgReportRetract("DGR-2026-0002",5)');
    assert.equal(ui2.fetches[0].body[0].reason.length, 400);
  });
  test('hata eşlemeleri: 0010 eksik / mülkiyet / kota / yineleme', async () => {
    const cases = [
      [{ status: 404, text: 'relation "public.report_retractions" does not exist' }, /0010_report_retraction\.sql/],
      [{ status: 400, text: 'RETRACT_NOT_YOUR_PARK (DGR0RP): park #9 için projen yok' }, /kendi parkının/],
      [{ status: 400, text: 'RETRACT_QUOTA (DGR0RQ): sınır' }, /sınırına ulaştın/],
      [{ status: 400, text: 'RETRACT_DUPLICATE (DGR0RD): zaten var' }, /zaten var/],
      [{ status: 400, text: 'RETRACT_BAD_ID (DGR0RF): biçim' }, /geçersiz/i],
      [{ status: 401, text: 'permission denied for table report_retractions' }, /Yetki yok/],
    ];
    for (const [post, re] of cases) {
      const ui = bootRet({});
      ui.setPost(post);
      await ui.run('dgReportRetract("DGR-2026-0002",5)');
      assert.match(ui.lastToast()[0], re, JSON.stringify(post.text));
      assert.equal(ui.lastToast()[1], 'err');
    }
  });
  test('window kaydı + tablo yoksa panel çökmez (sessiz boş liste)', async () => {
    const ui = bootRet({ retError: { code: '42P01', message: 'relation "public.report_retractions" does not exist' } });
    assert.equal(ui.run('typeof window.dgReportRetract'), 'function');
    await ui.run('dgUserPubOpen(11)');
    assert.ok(ui.userHtml().length > 0, 'panel render oldu');
  });
});

describe('istemci: kullanıcı paneli 🗑 (vm)', () => {
  const QPUB = { schema: 'x', entries: [QE('DGR-2026-0007', 6)] };
  test('yayınlanmış parkta 🗑 düğmesi panelde de var', async () => {
    const ui = bootRet({ profile: { id: 'u-2', role: 'user' }, queue: QPUB });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.userHtml();
    assert.match(h, /badge on">Yayınlandı/);
    assert.match(h, /dgReportRetract\('DGR-2026-0007',6\)/);
    assert.match(h, /🗑 Geri çek/);
  });
  test('geri çekilmiş park: rozet + bağlantı yok + 📄 Yayınla açık', async () => {
    const ui = bootRet({ profile: { id: 'u-2', role: 'user' }, queue: { schema: 'x', entries: [QE('DGR-2026-0007', 6), { status: 'Geri çekildi', report_id: 'DGR-2026-0007', park_id: 6, retraction_id: 'r', reason: 'kazayla', finished_at: '2026-09-28T09:00:00Z' }] } });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.userHtml();
    assert.match(h, /badge off">Geri çekildi/);
    assert.ok(!h.includes('https://dendrogeo.org/rapor/DGR-2026-0007/'));
    assert.match(h, /onclick="dgUserPublish\(6\)"/);
  });
  test('bekleyen geri çekme: "Geri çekiliyor" + 📄/🗑 gizli', async () => {
    const ui = bootRet({
      profile: { id: 'u-2', role: 'user' }, queue: QPUB,
      retractions: [{ id: 'ret-1', report_id: 'DGR-2026-0007', park_id: 6, status: 'Beklemede', requested_by: 'u-2', created_at: new Date().toISOString() }],
    });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.userHtml();
    assert.match(h, /badge admin">Geri çekiliyor/);
    assert.ok(!/dgReportRetract/.test(h));
    assert.ok(!/dgUserPublish/.test(h));
  });
  test('yeni CSS yok: 🗑 düğmesi mevcut sınıflarla (btn sm red)', () => {
    assert.match(UI, /class="btn sm red" onclick="dgReportRetract/);
    assert.ok(!/dg-retract|retraction\.css/.test(UI), 'yeni sınıf ailesi yok');
    assert.ok(!existsSync(join(ROOT, 'css/retraction.css')));
  });
});
