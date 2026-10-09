/* report-publish.test.mjs — SİTE İÇİNDEN RAPOR YAYINI bekçileri (2026-09-27)
 *
 * KULLANICI İSTEĞİ: "raporu site üstünden yayınlayacağım" — GitHub Actions
 * arayüzüne gitmeden, uygulama içinden. Bu dosya o hattın ÜÇ ayağını kilitler:
 *
 *   1) VERİTABANI (0008_report_publish.sql): isteği yalnız yönetici açar,
 *      Actions anon anahtarla OKUYABİLİR, aynı park için tek bekleyen istek,
 *      onaylı verisi olmayan park için istek açılamaz.
 *   2) YAYIN İŞİ (rapor-yayin.yml + scripts/publish-queue.mjs): 5 dk'da bir
 *      kuyruğu boşaltır, sonucu repo'ya yazar, aynı isteği İKİ KEZ üretmez,
 *      Supabase'e YAZMAZ (service_role anahtarı bu hatta yoktur).
 *   3) ARAYÜZ (src/services/report-publish.js): kart yalnız yönetici
 *      sekmesinde, bağlantı YALNIZ biçimi doğrulanmış DGR kimliğinden kurulur
 *      (oynanmış günlük dosyası dış bağlantı sokamaz), yeni CSS yok.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { planQueue, effectiveProcessedRequestIds, REQUEST_RETRY_MAX, loadQueue, saveQueue, emptyQueue, QUEUE_SCHEMA, QUEUE_CAP, QUEUE_PATH } from '../scripts/publish-queue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SQL = read('supabase/migrations/0008_report_publish.sql');
const WF = read('.github/workflows/rapor-yayin.yml');
const PQ = read('scripts/publish-queue.mjs');
const MR = read('scripts/make-report.mjs');
const UI = read('src/services/report-publish.js');
const SHELL = read('partials/shell.html');
const IDX = read('index.html');
const SW = read('sw.js');

/* ============================================================ 1) VERİTABANI */
describe('0008: yayın isteği tablosu ve yetki modeli', () => {
  test('tablo + zorunlu sütunlar (idempotent DDL)', () => {
    assert.match(SQL, /create table if not exists public\.report_requests/);
    for (const col of ['park_id', 'with_lulc', 'status', 'requested_by', 'created_at', 'cancelled_at'])
      assert.match(SQL, new RegExp(col), 'sütun: ' + col);
    assert.match(SQL, /references public\.parks\(id\) on delete cascade/, 'park FK + cascade');
    assert.match(SQL, /check \(status in \('Beklemede','Vazgeçildi'\)\)/, 'durum kümesi kapalı');
  });

  test('⭐ RLS açık; istek YALNIZ yöneticiden, okuma herkese (Actions anon)', () => {
    assert.match(SQL, /alter table public\.report_requests enable row level security/);
    assert.match(SQL, /create policy report_requests_select on public\.report_requests\s+for select\s+using \(true\)/, 'anon okuma: yayın işi kuyruğu buradan okur');
    assert.match(SQL, /create policy report_requests_insert on public\.report_requests\s+for insert to authenticated\s+with check \(public\.is_admin\(\)\)/, 'istek açma yalnız yönetici');
    assert.match(SQL, /using \(public\.is_admin\(\) and status = 'Beklemede'\)/, 'yalnız bekleyen istek iptal edilir');
    assert.match(SQL, /with check \(public\.is_admin\(\) and status = 'Vazgeçildi'\)/, 'iptal dışına durum yazılamaz');
    assert.match(SQL, /grant select on public\.report_requests to anon, authenticated/);
  });

  test('⭐ aynı park için TEK bekleyen istek (çift tıklama iki rapor üretmez)', () => {
    assert.match(SQL, /create unique index if not exists report_requests_one_pending_per_park\s+on public\.report_requests\(park_id\) where status = 'Beklemede'/);
  });

  test('sunucu kapısı: yönetici değilse ve onaylı veri yoksa istek reddedilir', () => {
    assert.match(SQL, /create or replace function public\.tg_report_request_gate\(\)/);
    assert.match(SQL, /REPORT_ADMIN_ONLY/, 'yetki hatası kodu');
    assert.match(SQL, /REPORT_NO_DATA/, 'boş park hatası kodu');
    assert.match(SQL, /m\.status = 'Onaylı'/, 'onaylı ölçüm şartı');
    assert.match(SQL, /create trigger trg_report_request_gate\s+before insert or update of park_id on public\.report_requests/, 'tetikleyici bağlı');
  });

  test('migration idempotent (tekrar çalıştırılabilir) ve README’de kayıtlı', () => {
    assert.match(SQL, /^begin;/m); assert.match(SQL, /^commit;/m);
    assert.match(SQL, /drop policy if exists/g, 'politikalar yeniden kurulabilir');
    assert.match(SQL, /drop trigger if exists/);
    assert.match(read('supabase/README.md'), /0008_report_publish\.sql/, 'README dosya listesi');
  });
});

/* ============================================================ 2) YAYIN İŞİ */
describe('rapor-yayin.yml: kuyruk 5 dakikada bir boşalır', () => {
  test('⭐ zamanlayıcı + elle tetik + commit yetkisi', () => {
    assert.match(WF, /schedule:/); assert.match(WF, /cron: '\*\/5 \* \* \* \*'/, '5 dk');
    assert.match(WF, /workflow_dispatch/, 'elle "hemen çalıştır"');
    assert.match(WF, /contents: write/, 'push yetkisi');
    assert.match(WF, /node scripts\/publish-queue\.mjs/, 'kuyruk betiği');
    assert.match(WF, /git add rapor\//, 'yalnız rapor dizini commit edilir');
  });

  test('çakışma kilidi: aynı anda TEK koşu, başlayan iş kesilmez', () => {
    assert.match(WF, /concurrency:\s+group: rapor-yayin-kuyrugu\s+cancel-in-progress: false/);
  });

  test('push yarışına karşı rebase + yeniden deneme', () => {
    assert.match(WF, /git pull --rebase origin main && git push/);
    assert.match(WF, /for i in 1 2 3/);
    assert.match(WF, /fetch-depth: 0/, 'rebase için tam geçmiş');
  });

  test('⭐ yayın kuyruğu Supabase için anon kalır; tek secret yalnız Zenodo DOI içindir', () => {
    assert.ok(!/SUPABASE_SERVICE_ROLE|service_role_key/.test(WF), 'Supabase süper anahtarı workflowa girmez');
    assert.match(WF, /ZENODO_TOKEN: \$\{\{ secrets\.ZENODO_TOKEN \}\}/, 'DOI tokeni yalnız Actions secret üzerinden');
    assert.match(WF, /node scripts\/register-pending-dois\.mjs/, 'başarılı rapordan sonra otomatik DOI işi');
    assert.ok(!/method:\s*['"](POST|PATCH|PUT|DELETE)['"]/.test(PQ), 'PostgREST’e yazma çağrısı yok (salt-okunur)');
    const key = read('src/config/supabase.js').match(/SB_KEY="([^"]+)"/)[1];
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(payload.role, 'anon', 'kuyruğun okuduğu anahtar anon rolünde');
    assert.match(PQ, /read\('src\/config\/supabase\.js'\)/, 'anahtar config’ten okunur (kopyalanmaz)');
    assert.match(PQ, /SB_KEY=/, 'betik anon anahtarı kullanıyor');
    assert.match(PQ, /QUEUE_PATH = 'rapor\/yayin-kuyrugu\.json'/, 'sonuç günlüğü repo’da');
  });
});

describe('publish-queue.mjs: plan + günlük', () => {
  const REQ = (id, park) => ({ id, park_id: park, with_lulc: true, status: 'Beklemede', created_at: '2026-09-27T10:00:00Z' });

  test('⭐ işlenmiş istek bir daha üretilmez (request_id günlüktedir)', () => {
    const entries = [{ request_id: 'r1', status: 'Yayınlandı', report_id: 'DGR-2026-0002' }];
    const p = planQueue(entries, [REQ('r1', 5), REQ('r2', 6)], 5);
    assert.deepEqual(p.todo.map((r) => r.id), ['r2'], 'r1 atlandı');
    assert.equal(p.already, 1);
  });

  test('başarısız istek otomatik yeniden denenir; üç hatadan sonra durur', () => {
    const once = [{ request_id: 'r1', status: 'Başarısız', message: 'x' }];
    assert.deepEqual(planQueue(once, [REQ('r1', 5)], 5, ['r1']).todo.map(r=>r.id), ['r1']);
    assert.ok(!effectiveProcessedRequestIds(once,['r1']).includes('r1'),'tek hata processed kilidini kaldırır');
    const thrice=Array.from({length:REQUEST_RETRY_MAX},(_,i)=>({request_id:'r1',status:'Başarısız',message:'x'+i}));
    assert.equal(planQueue(thrice,[REQ('r1',5)],5,['r1']).todo.length,0,'retry sınırı sonsuz döngüyü keser');
  });

  test('limit sonraki koşuya bırakır (tek koşuda sınırsız üretim yok)', () => {
    const p = planQueue([], [REQ('a', 1), REQ('b', 2), REQ('c', 3), REQ('d', 4)], 2);
    assert.equal(p.todo.length, 2); assert.equal(p.skipped, 2);
  });

  test('günlük okuma/yazma: şema korunur, kapasite aşımı eskileri düşürür', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dgq-'));
    const rel = join(dir, 'q.json');
    assert.deepEqual(loadQueue(rel), emptyQueue(), 'olmayan dosya → boş günlük');
    const q = { schema: QUEUE_SCHEMA, entries: Array.from({ length: QUEUE_CAP + 30 }, (_, i) => ({ request_id: 'r' + i, status: 'Yayınlandı', report_id: 'DGR-2026-' + String(i).padStart(4, '0') })) };
    const out = saveQueue(q, rel);
    assert.equal(out.entries.length, QUEUE_CAP, 'kap sınırlı');
    assert.equal(out.entries[out.entries.length - 1].request_id, 'r' + (QUEUE_CAP + 29), 'en yeni kalır');
    assert.equal(loadQueue(rel).entries.length, QUEUE_CAP, 'geri okundu');
    /* bozuk dosya günlük hattını çökertmez */
    saveQueue({ schema: 'yanlış/1', entries: 'x' }, rel);
    assert.deepEqual(loadQueue(rel), emptyQueue(), 'bozuk günlük → boş');
  });

  test('üretim günlüğü test yayınlarını yeniden yayımlamaz', () => {
    const q = loadQueue();
    assert.equal(q.schema, QUEUE_SCHEMA);
    assert.ok(q.production_started_at);
    assert.match(q.test_archive_ref, /archive\/test-publications-/);
    assert.ok(q.retired_report_ids.includes('DGR-2026-0001'));
    assert.ok(q.retired_report_ids.includes('DGR-2026-0020'));
    assert.ok(q.processed_request_ids.length >= 21);
    assert.ok(q.processed_retraction_ids.length >= 19);
    assert.ok(!q.entries.some(e => q.retired_report_ids.includes(e.report_id)));
    const retracted=new Set(q.entries.filter(e=>e.status==='Geri çekildi').map(e=>e.report_id));
    for(const e of q.entries.filter(e=>e.status==='Yayınlandı'&&!retracted.has(e.report_id))) {
      const h=read('rapor/'+e.report_id+'/index.html');
      assert.ok(h.includes(e.report_hash.replace('sha256:', '')));
      assert.equal(e.park_id,JSON.parse(read('rapor/'+e.report_id+'/data.json')).park.id);
    }
    assert.match(read('rapor/DGR-2026-0020/index.html'), /noindex,nofollow/);
    assert.ok(!existsSync(join(ROOT,'rapor/DGR-2026-0020/data.json')));
  });

  test('günlükteki her başarılı girdi rapor diziniyle birebir örtüşür', () => {
    const q = loadQueue();
    for (const e of q.entries.filter((x) => x.status === 'Yayınlandı')) {
      assert.match(e.report_id, /^DGR-\d{4}-\d{4}$/, 'kimlik biçimi');
      assert.equal(e.url_path, '/rapor/' + e.report_id + '/', 'yol kimlikten türer');
      assert.ok(existsSync(join(ROOT, 'rapor', e.report_id, 'index.html')), e.report_id + ' dizini');
    }
  });
});

describe('make-report.mjs: tek üretici publishPark()', () => {
  test('publishPark dışa açık ve CLI onu kullanıyor (iki yol, tek çıktı)', () => {
    assert.match(MR, /export async function publishPark\(/);
    assert.match(MR, /const r = await publishPark\(parkId, \{ skipLulc: has\('skip-lulc'\), study \}\)/, 'main → publishPark');
    assert.match(MR, /SITE_ORIGIN/, 'bağlantı CNAME’den türetilir');
  });

  test('ölçüm protokolü provenance kaynağı buildSnapshot kapsamında tanımlıdır', () => {
    assert.match(MR,/const rhoBase = loadRho\(\)/);
    assert.match(MR,/measurementProtocol: rhoBase\.measurementLockId/);
    assert.match(MR,/measurementProtocolFingerprint: rhoBase\.measurementLockFingerprint/);
    assert.match(MR,/buildReportProvenance\(/);
    assert.doesNotMatch(MR,/measurement_protocol: base\.measurementLockId/);
  });

  test('⭐ üretilen sayfada paylaş düğmesi var (Web Share + pano yedeği)', () => {
    assert.match(MR, /id="dgShareBtn" onclick="dgShareReport\(\)">📤 Paylaş</);
    assert.match(MR, /async function dgShareReport\(\)/);
    assert.match(MR, /navigator\.share/, 'yerel paylaşım');
    assert.match(MR, /navigator\.clipboard\.writeText\(url\)/, 'pano yedeği');
    assert.match(MR, /window\.prompt\(/, 'pano da yoksa elle kopyalama');
  });

  test('yayınlanan rapor sayfaları paylaş düğmesini taşıyor', () => {
    /* 0010: geri çekilen yayının sayfası BİLDİRİMdir — paylaş düğmesi taşımaz.
     * DGR-2026-0001 ayrıca bu hattan önce dondurulmuştu (v1 şablon). */
    let retracted = new Set();
    try { retracted = new Set(loadQueue().entries.filter((x) => x.status === 'Geri çekildi').map((x) => String(x.report_id))); } catch (e) { /* günlük yoksa boş */ }
    for (const d of readdirSync(join(ROOT, 'rapor')).filter((x) => x.startsWith('DGR-'))) {
      if (retracted.has(d) || !existsSync(join(ROOT,'rapor',d,'data.json'))) continue;
      const t = read('rapor/' + d + '/index.html');
      if (d === 'DGR-2026-0001') continue;
      assert.match(t, /dgShareReport\(\)/, d + ' paylaş düğmesi');
    }
  });
});

/* ============================================================ 3) ARAYÜZ */
describe('arayüz bağlantısı: kart, modül kaydı, çevrimdışı paket', () => {
  test('⭐ kart YALNIZ yönetici sekmesinde (v-admin) — başka görünüm kaymaz', () => {
    const a = SHELL.indexOf('<div class="view" id="v-admin">');
    const b = SHELL.indexOf('<div class="view" id="v-users">');
    const seg = SHELL.slice(a, b);
    assert.ok(a > 0 && b > a, 'v-admin/v-users sırası');
    assert.match(seg, /Bilimsel Rapor Yayını/, 'kart v-admin içinde');
    assert.ok(!SHELL.slice(0, a).includes('Bilimsel Rapor Yayını'), 'başka sekmede yok');
    for (const id of ['dgPubBox', 'dgPubLulc', 'dgPubClock'])
      assert.match(seg, new RegExp('id="' + id + '"'), id + ' kartta');
    assert.match(seg,/class="dg-switch" id="dgPubLulc"/,'§5 seçimi yerel checkbox yerine tema switch kullanır');
    assert.ok(!SHELL.slice(b).includes('dgPubBox'), 'kart v-users’a taşmıyor');
  });

  test('modül kaydı: index.html + sw.js CORE_ASSETS (çevrimdışı)', () => {
    assert.match(IDX, /<script src="src\/services\/report-publish\.js\?v=[0-9a-f]{8}" defer><\/script>/);
    assert.match(SW, /'\/src\/services\/report-publish\.js'/);
    assert.match(read('partials/head.html'), /src\/services\/report-publish\.js/, 'kaynak partial');
  });

  test('yönetim sekmesi açılınca kuyruk yüklenir (typeof korumalı)', () => {
    assert.match(read('src/services/admin.js'), /if\(typeof dgLoadPublishQueue==="function"\)dgLoadPublishQueue\(\);/);
  });

  test('⭐ yayın merkezi ana temaya uyumlu, günlük ve kurallar katlanabilir', () => {
    const seg = SHELL.slice(SHELL.indexOf('Bilimsel Rapor Yayını') - 500, SHELL.indexOf('dgPubBox') + 200);
    assert.match(seg,/admin-publish-card/);
    assert.match(seg,/admin-publish-toolbar/);
    assert.match(read('css/style.css'),/\.admin-publish-summary\{/);
    assert.match(UI,/admin-publish-table/);
    assert.match(UI,/admin-publish-log/);
    assert.match(UI,/admin-publish-help/);
    assert.match(UI, /class="badge (on|off|admin)"/, 'durum rozetleri ortak ailede');
  });

  test('istemci insert RLS-safe desenle (return=minimal, oturum anahtarı)', () => {
    assert.match(UI, /"Prefer":"return=minimal"/);
    assert.match(UI, /await sb\.auth\.getSession\(\)/, 'anon istek açamaz');
    assert.match(UI, /function dgPubAdmin\(\)/, 'yönetici kapısı');
  });
});

/* ---------- modülü vm’de çalıştırıp GERÇEK davranışı ölç ---------- */
function bootUI() {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', checked: true, style: {}, classList: { contains: () => true } });
  for (const id of ['dgPubBox', 'dgPubClock', 'dgPubLulc', 'v-admin']) el(id);
  const toasts = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: (id) => (els[id] || null), hidden: false, querySelector: () => null },
    navigator: { clipboard: { writeText: async () => {} } },
    location: { href: 'https://dendrogeo.org/' },
    window: null,
    SB_URL: 'https://x.supabase.co', SB_KEY: 'anon-key',
    PROFILE: { id: 'u1', role: 'owner' }, USER: { id: 'u1' },
    toast: (m, t) => toasts.push([m, t]),
    confirm: () => true,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }),
    setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 0,
    URL, URLSearchParams, Math, JSON, Date, Number, Array, Object, String, Boolean, RegExp, Error, Promise, Intl,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('src/config/constants.js'), ctx, { filename: 'constants.js' });
  vm.runInContext(UI, ctx, { filename: 'report-publish.js' });
  const run = (code) => vm.runInContext(code, ctx);
  const setState = (patch) => run('Object.assign(DG_PUB_STATE,' + JSON.stringify(patch) + ')');
  return { ctx, els, toasts, run, setState, html: () => els.dgPubBox.innerHTML };
}

describe('report-publish.js davranışı (vm)', () => {
  test('⭐ bağlantı YALNIZ geçerli DGR kimliğinden kurulur', () => {
    const { run } = bootUI();
    assert.equal(run('dgPubUrl("DGR-2026-0001")'), 'https://dendrogeo.org/rapor/DGR-2026-0001/');
    for (const bad of ['', null, 'DGR-2026-1', 'javascript:alert(1)', 'https://evil.example/x', 'DGR-2026-0001/../../', '<img src=x>'])
      assert.equal(run('dgPubUrl(' + JSON.stringify(bad) + ')'), '', 'reddedilmeli: ' + bad);
  });

  test('⭐ oynanmış günlük dış bağlantı sokamaz (url_path’e güvenilmez)', () => {
    const ui = bootUI();
    ui.setState({
      parks: [{ park_id: 7, park_name: 'Deneme Parkı', city: 'Ankara', records: 3, carbon_kg: 1200, species_n: 2, contributors: 1, area_m2: 40000 }],
      requests: [],
      queue: { schema: QUEUE_SCHEMA, entries: [{ request_id: 'x', park_id: 7, status: 'Yayınlandı', report_id: 'DGR-2026-0009', url_path: 'http://evil.example/tuzak', park_name: 'Deneme Parkı', n: 3, carbon_txt: '1 t', finished_at: '2026-09-27T10:00:00Z' }] },
      error: '',
    });
    ui.run('dgPubRender()');
    const h = ui.html();
    assert.ok(!/evil\.example/.test(h), 'günlükteki url_path sızmadı');
    assert.ok(h.includes('https://dendrogeo.org/rapor/DGR-2026-0009/'), 'bağlantı kimlikten kuruldu');
    /* rapor kimliği de bozuksa hiç bağlantı üretilmez */
    ui.setState({ queue: { schema: QUEUE_SCHEMA, entries: [{ request_id: 'x', park_id: 7, status: 'Yayınlandı', report_id: 'javascript:alert(1)', url_path: 'http://evil.example' }] } });
    ui.run('dgPubRender()');
    assert.ok(!/javascript:/.test(ui.html()), 'kimlik biçimi bozuksa bağlantı yok');
    assert.ok(!/evil/.test(ui.html()));
  });

  test('bekleyen istek: rozet + iptal + beklenti metni', () => {
    const ui = bootUI();
    ui.setState({
      parks: [{ park_id: 5, park_name: 'A Parkı', city: 'Ankara', records: 2, carbon_kg: 24000, species_n: 2, contributors: 1, area_m2: 852000 }],
      requests: [{ id: 'r1', park_id: 5, status: 'Beklemede', with_lulc: true, created_at: new Date(Date.now() - 3 * 60000).toISOString() }],
      queue: { schema: QUEUE_SCHEMA, entries: [] }, error: '',
    });
    ui.run('dgPubRender()');
    const h = ui.html();
    assert.match(h, /badge admin">Beklemede/);
    assert.match(h, /3 dk önce kuyruğa alındı/);
    assert.match(h, /dgPublishCancel\('r1'\)/, '✖ Vazgeç');
    assert.match(h, /yayın işi 5 dakikada bir çalışır/i);
    assert.ok(!/dgReportOpen/.test(h), 'yayınlanmadan bağlantı düğmesi yok');
  });

  test('yayınlandı: 🔗 Aç + 📤 Paylaş + yeni sürüm düğmesi', () => {
    const ui = bootUI();
    ui.setState({
      parks: [{ park_id: 5, park_name: 'A Parkı', city: 'Ankara', records: 2, carbon_kg: 24000, species_n: 2, contributors: 1, area_m2: 852000 }],
      requests: [{ id: 'r1', park_id: 5, status: 'Beklemede', created_at: new Date().toISOString() }],
      queue: { schema: QUEUE_SCHEMA, entries: [{ request_id: 'r1', park_id: 5, status: 'Yayınlandı', report_id: 'DGR-2026-0002', park_name: 'A Parkı', n: 2, carbon_txt: '24 t', finished_at: '2026-09-27T12:00:00Z' }] },
      error: '',
    });
    ui.run('dgPubRender()');
    const h = ui.html();
    assert.match(h, /badge on">Yayınlandı/);
    assert.match(h, /dgReportOpen\('DGR-2026-0002'\)/);
    assert.match(h, /dgReportShare\('DGR-2026-0002'\)/);
    assert.match(h, /📄 Yeni sürüm/, 'yeni çözümleme yeni kimlik');
    assert.match(h, /DGR-2026-0002/, 'kimlik görünür');
  });

  test('0008 uygulanmamışsa kart yapılacak işi söylüyor (sessiz ölüm yok)', () => {
    const ui = bootUI();
    ui.setState({ error: 'SCHEMA', parks: [], requests: [], queue: null });
    ui.run('dgPubRender()');
    assert.match(ui.html(), /0008_report_publish\.sql/);
    assert.match(ui.html(), /alert warn/);
  });

  test('günlük okunamazsa istek gönderimi yine çalışır (çevrimdışı ayrımı)', () => {
    const ui = bootUI();
    ui.setState({ error: '', parks: [], requests: [], queue: null });
    ui.run('dgPubRender()');
    assert.match(ui.html(), /Yayın günlüğü okunamadı/);
  });

  test('⭐ yönetici olmayan yayın isteği açamaz (fetch hiç çağrılmaz)', async () => {
    const ui = bootUI();
    let called = 0;
    ui.ctx.fetch = async () => { called++; return { ok: true, status: 201, text: async () => '' }; };
    ui.run('PROFILE={id:"u2",role:"user"}');
    await ui.run('dgPublishReport(5)');
    assert.equal(called, 0, 'istemci kapısı isteği göndermedi');
    assert.equal(ui.toasts[ui.toasts.length - 1][1], 'err');
  });

  test('paylaş: geçerli kimlikte pano, geçersizde uyarı', async () => {
    const ui = bootUI();
    const written = [];
    ui.ctx.navigator.clipboard.writeText = async (t) => written.push(t);
    await ui.run('dgReportShare("DGR-2026-0002")');
    assert.deepEqual(written, ['https://dendrogeo.org/rapor/DGR-2026-0002/']);
    await ui.run('dgReportShare("http://evil.example")');
    assert.equal(written.length, 1, 'geçersiz kimlik panoya yazılmadı');
    assert.equal(ui.toasts[ui.toasts.length - 1][1], 'err');
  });
});
