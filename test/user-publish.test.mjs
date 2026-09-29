/* user-publish.test.mjs — KULLANICILAR KENDİ PARKINI YAYINLAR (0009) bekçileri
 *
 * KULLANICI İSTEĞİ (2026-09-28): "kullanıcılar kendi park projelerini
 * paylaşabilecek değil mi?" → doğrudan yayın. Bu dosya üç ayağı kilitler:
 *
 *   1) VERİTABANI (0009_user_report_publish.sql): yönetici olmayan kullanıcı
 *      YALNIZ kendi projesinin parkı için, kendi onaylı ölçümü varsa, 24
 *      saatte en fazla 3 kez istek açabilir; requested_by = auth.uid();
 *      kendi bekleyen isteğini iptal edebilir. 0008'in kilitleri (park başına
 *      tek bekleyen istek, onaylı veri şartı, select anon'a açık, delete
 *      yalnız yönetici) AYNEN durur.
 *   2) ARAYÜZ KABLOLAMASI: 📁 Projeler'de parkı bağlı satırda 📄 düğmesi,
 *      v-projects içinde display:none panel kutusu, sw.js r43, yeni CSS yok.
 *   3) DAVRANIŞ (vm): panel durumları (yok/beklemede/yabancı beklemede/
 *      yayınlandı/başarısız), insert gövdesi + oturum anahtarı, kota ve
 *      mülkiyet hata eşlemeleri, iptal yetkisi, oynanmış günlük dış
 *      bağlantı sokamaz, yönetici kartının kapısı değişmedi.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SQL9 = read('supabase/migrations/0009_user_report_publish.sql');
const UI = read('src/services/report-publish.js');
const MEAS = read('src/services/measure.js');
const SHELL = read('partials/shell.html');
const SW = read('sw.js');
const DOCS = read('docs/rapor-yayini.md');

/* ============================================================ 1) VERİTABANI */
describe('0009: kullanıcı yayını yetki modeli (SQL)', () => {
  test('tetikleyici yönetici dalını KORUR (0008 hakkı değişmez)', () => {
    assert.match(SQL9, /create or replace function public\.tg_report_request_gate\(\)/);
    assert.match(SQL9, /if public\.is_admin\(\) then/, 'yönetici dalı');
    assert.match(SQL9, /create trigger trg_report_request_gate\s+before insert or update of park_id on public\.report_requests/, 'tetikleyici aynı olaylarla yeniden bağlı');
  });

  test('⭐ kimlik: istek yalnız kendi adına (requested_by = auth.uid())', () => {
    assert.match(SQL9, /new\.requested_by is distinct from auth\.uid\(\)/);
    assert.match(SQL9, /REPORT_NOT_SELF \(DGR0NS\)/);
    assert.match(SQL9, /errcode = 'DG0NS'/);
  });

  test('⭐ mülkiyet: park, kullanıcının projesine bağlı olmalı', () => {
    assert.match(SQL9, /from public\.projects p\s+where p\.owner = auth\.uid\(\)\s+and p\.park_id = new\.park_id/);
    assert.match(SQL9, /REPORT_NOT_YOUR_PARK \(DGR0NP\)/);
    assert.match(SQL9, /errcode = 'DG0NP'/);
  });

  test('⭐ kendi verisi: parkta en az bir ONAYLI ölçümü olmalı (silinmiş hariç)', () => {
    assert.match(SQL9, /m\.owner = auth\.uid\(\)/);
    assert.match(SQL9, /m\.status = 'Onaylı'/);
    assert.match(SQL9, /m\.deleted_at is null/);
    assert.match(SQL9, /\(m\.park_id = new\.park_id or p2\.park_id = new\.park_id\)/, 'denormalize park_id + eski satırlar için proje bağı');
    assert.match(SQL9, /REPORT_NO_OWN_DATA \(DGR0ND\)/);
  });

  test('⭐ kota: yönetici olmayan 24 saatte en fazla 3 istek (iptaller de sayılır)', () => {
    assert.match(SQL9, /quota constant int := 3/);
    assert.match(SQL9, /r\.created_at > now\(\) - interval '24 hours'/);
    assert.match(SQL9, /where r\.requested_by = auth\.uid\(\)/, 'kota kullanıcı başına');
    assert.ok(!/status\s*(<>|!=|not in)[^\n]*Vazgeçildi/.test(SQL9.split('select count(*) into recent')[1] || ''), 'iptal edilenler de kotalanır (aç-kapat döngüsü yoramaz)');
    assert.match(SQL9, /REPORT_QUOTA \(DGR0QT\)/);
  });

  test('0008 park-geneli onaylı veri şartı fonksiyonda DURUYOR (replace tüm gövdeyi değişir)', () => {
    assert.match(SQL9, /REPORT_NO_DATA \(DGR0RD\)/);
    assert.match(SQL9, /where m\.park_id = new\.park_id\s+and m\.status = 'Onaylı'\s+and m\.deleted_at is null/);
  });

  test('RLS insert: yönetici VEYA (kendi adına + aktif + parkına projesi olan)', () => {
    assert.match(SQL9, /create policy report_requests_insert on public\.report_requests\s+for insert to authenticated\s+with check \(\s+public\.is_admin\(\)\s+or \(/);
    assert.match(SQL9, /requested_by = auth\.uid\(\)\s+and public\.is_active\(\)/, 'kimlik + engelli hesap kilidi (0001 deseni)');
    assert.match(SQL9, /p\.park_id = report_requests\.park_id/, 'aday satırın parkına bağ (iç sorguda nitelenmiş)');
  });

  test('RLS update: kullanıcı YALNIZ kendi bekleyen isteğini iptal eder', () => {
    assert.match(SQL9, /using \(\(public\.is_admin\(\) or requested_by = auth\.uid\(\)\) and status = 'Beklemede'\)/);
    assert.match(SQL9, /with check \(\(public\.is_admin\(\) or requested_by = auth\.uid\(\)\) and status = 'Vazgeçildi'\)/, 'iptal dışına durum yazılamaz');
  });

  test('gevşetilmeyenler: select (anon) ve delete (yalnız yönetici) 0009da YOK', () => {
    assert.ok(!/report_requests_select/.test(SQL9), 'select politikasına dokunulmaz (Actions anon okur)');
    assert.ok(!/report_requests_delete/.test(SQL9), 'delete politikasına dokunulmaz (yalnız yönetici)');
    assert.ok(!/report_requests_one_pending_per_park/.test(SQL9), 'kısmi unique index 0008de kalır');
  });

  test('migration idempotent ve belgeli', () => {
    assert.match(SQL9, /^begin;/m); assert.match(SQL9, /^commit;/m);
    assert.ok((SQL9.match(/drop policy if exists/g) || []).length >= 2);
    assert.match(SQL9, /drop trigger if exists trg_report_request_gate/);
    assert.match(read('supabase/README.md'), /0009_user_report_publish\.sql/, 'README dosya listesi');
    assert.match(read('supabase/README.md'), /9\. `0009_user_report_publish\.sql` → Run/, 'README uygulama sırası');
    assert.match(DOCS, /1b\) Kısa yol \(kullanıcı/, 'işletim rehberi kullanıcı bölümü');
    assert.match(DOCS, /REPORT_QUOTA/, 'rehberde kota tablosu');
  });
});

/* ============================================================ 2) KABLOLAMA */
describe('arayüz kablolaması: 📄 düğmesi + panel kutusu', () => {
  test('⭐ panel kutusu v-projects içinde ve başlangıçta görünmez (düzen kaymaz)', () => {
    const a = SHELL.indexOf('<div class="view" id="v-projects">');
    const b = SHELL.indexOf('<div class="view" id="v-records">');
    assert.ok(a > 0 && b > a, 'v-projects/v-records sırası');
    const seg = SHELL.slice(a, b);
    const i = seg.indexOf('id="dgUserPubBox"');
    assert.ok(i > 0, 'kutu projeler sekmesinde');
    assert.match(seg.slice(i - 60, i + 140), /class="card" style="display:none/, 'boş + display:none → sıfır yer');
    assert.ok(!SHELL.slice(b).includes('dgUserPubBox'), 'başka sekmeye taşmıyor');
  });

  test('yönetici kartının başlığı TEKİL kalır (kullanıcı paneli başka ad taşır)', () => {
    assert.equal((SHELL.match(/Bilimsel Rapor Yayını/g) || []).length, 1, '0008 bekçisi: kart yalnız v-adminde');
    assert.ok(SHELL.includes('Park Raporu'), 'kullanıcı paneli farklı başlıkta');
  });

  test('📄 düğmesi yalnız parkı bağlı projede + panel senkronu typeof korumalı', () => {
    assert.match(MEAS, /const repBtn=p\.park_id/, 'parksız projede düğme yok');
    assert.match(MEAS, /dgUserPubOpen\(\$\{p\.id\}\)/, 'satır düğmesi paneli açar');
    assert.match(MEAS, /if\(typeof dgUserPubSync==="function"\)dgUserPubSync\(PROJ_LIST\);/, 'proje silinirse panel kapanır');
  });

  test('yeni CSS yok: panel mevcut bileşen ailelerini kullanıyor', () => {
    assert.ok(!/dg-user-pub|user-publish\.css/.test(SHELL), 'yeni sınıf ailesi/dosyası yok');
    assert.ok(!existsSync(join(ROOT, 'css/user-publish.css')));
    for (const cls of ['shead', 'badge on', 'badge off', 'badge admin', 'btn sm blue', 'btn sm red', 'btn sm amber', 'alert warn', 'dg-tree-meta', 'dg-parkadmin-note'])
      assert.ok(UI.includes(cls), 'UI sınıfı mevcut aileden: ' + cls);
  });

  test('çevrimdışı paket: sw.js r46 ve modül CORE_ASSETS’te kalır', () => {
    // 0011: r43→r44; 0011b → r45; 0025 park-invites precache → r46.
    // Sözleşme: önbeklenen içerik değiştiğinde CACHE_VERSION artmak zorunda.
    assert.match(SW, /CACHE_VERSION = 'dendrogeo-sw-v2-r46'/, 'içerik değişti → sürüm arttı');
    assert.match(SW, /'\/src\/services\/report-publish\.js'/);
  });
});

/* ---------- vm: modülü GERÇEK davranışıyla ölç ---------- */
function bootUser(opts) {
  const o = opts || {};
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', style: {}, checked: true, classList: { contains: () => true }, scrollIntoView() {} });
  for (const id of ['dgUserPubBox', 'dgUserPubLulc', 'v-projects', 'dgPubBox', 'dgPubLulc', 'dgPubClock', 'v-admin']) el(id);
  const toasts = [], calls = [], fetches = [];
  const RESULTS = {
    report_requests: { data: o.requests || [], error: o.reqError || null },
    measurements: { count: o.ownApproved === undefined ? 2 : o.ownApproved },
  };
  const chain = (table) => {
    const t = { then: (res) => res(RESULTS[table] || { data: [], error: null }) };
    for (const m of ['select', 'eq', 'order', 'limit', 'is', 'update', 'insert'])
      t[m] = (...a) => { calls.push([table, m, a]); return t; };
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
    PROFILE: o.profile || { id: 'u-2', role: 'user' }, USER: { id: 'u-2' },
    PROJ_LIST: o.projects || [{ id: 11, park_id: 6, parks: { name: 'Göksu Parkı' }, name: 'Göksu Parkı - deneme' }],
    toast: (m, t) => toasts.push([m, t]),
    confirm: () => o.confirm !== false,
    sb: { from: (table) => chain(table), auth: { getSession: async () => ({ data: { session: { access_token: 'tok-1' } } }) } },
    fetch: async (u, op) => {
      const m = (op && op.method) || 'GET';
      if (m === 'POST') { fetches.push({ url: u, headers: op.headers, body: JSON.parse(op.body) }); return { ok: POST.status < 300, status: POST.status, text: async () => POST.text }; }
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
    ctx, els, toasts, calls, fetches, run,
    setPost: (p) => { POST = p; },
    setQueue: (q) => { QUEUE = q; },
    setRequests: (r) => { RESULTS.report_requests = { data: r, error: null }; },
    html: () => els.dgUserPubBox.innerHTML,
    lastToast: () => toasts[toasts.length - 1],
  };
}
const REQ = (id, park, status, by, minAgo) => ({ id, park_id: park, status, requested_by: by, with_lulc: true, created_at: new Date(Date.now() - (minAgo || 0) * 60000).toISOString(), cancelled_at: null });

describe('kullanıcı paneli davranışı (vm)', () => {
  test('parkı bağlı olmayan proje panel açmaz (rapor park kimliği ister)', async () => {
    const ui = bootUser({ projects: [{ id: 12, park_id: null }] });
    await ui.run('dgUserPubOpen(12)');
    assert.match(ui.lastToast()[0], /parka bağlı değil/);
    assert.equal(ui.lastToast()[1], 'err');
    assert.equal(ui.html(), '', 'kutuya dokunulmadı');
    assert.equal(ui.fetches.length, 0);
  });

  test('yayın yok: rozet + 📄 Yayınla + 🛰 tercihi + dürüstlük notları', async () => {
    const ui = bootUser();
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.match(h, /badge off">Yayın yok/);
    assert.match(h, /dgUserPublish\(6\)/, 'yayınla düğmesi park kimliğiyle');
    assert.match(h, /📄 Yayınla/);
    assert.match(h, /id="dgUserPubLulc" checked/, '§5 tercihi varsayılan açık');
    assert.match(h, /park düzeyindedir/, 'raporun kapsamı kullanıcıya söylenir');
    assert.match(h, /tüm onaylı ölçümleri/, 'yalnız kendi projesi değil');
    assert.match(h, /24 saatte en fazla 3 istek/, 'kota şeffaf');
    assert.match(h, /2 onaylı ölçümün var/, 'kendi onaylı veri sayısı');
    assert.match(h, /dgUserPubClose\(\)/, 'kapat düğmesi');
  });

  test('kendi bekleyen isteği: rozet + süre + ✖ Vazgeç; yayın düğmesi yok', async () => {
    const ui = bootUser({ requests: [REQ('r1', 6, 'Beklemede', 'u-2', 3)] });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.match(h, /badge admin">Beklemede/);
    assert.match(h, /3 dk önce kuyruğa alındı/);
    assert.match(h, /yayın işi 5 dakikada bir çalışır/);
    assert.match(h, /dgUserCancel\('r1'\)/, 'kendi isteğini iptal edebilir');
    assert.ok(!/dgUserPublish/.test(h), 'beklerken ikinci istek düğmesi yok');
    assert.ok(!/dgUserPubLulc/.test(h), 'beklerken tercih de yok');
  });

  test('⭐ başkasının bekleyen isteği: ✖ Vazgeç YOK, bilgi notu var', async () => {
    const ui = bootUser({ requests: [REQ('r9', 6, 'Beklemede', 'u-9', 5)] });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.ok(!/dgUserCancel/.test(h), 'başkasının isteğini iptal düğmesi çizilmez');
    assert.match(h, /başka bir katkıda bulunan/, 'kimin isteği şeffaf');
    /* düğme çizilmese bile fonksiyon sunucu/istemci kapısıyla korunur */
    await ui.run('dgUserCancel("r9")');
    assert.match(ui.lastToast()[0], /Yalnız kendi bekleyen isteğini/);
    assert.equal(ui.calls.filter((c) => c[1] === 'update').length, 0, 'update hiç çağrılmadı');
  });

  test('kendi isteğini iptal: update Vazgeçildi + başarılı toast', async () => {
    const ui = bootUser({ requests: [REQ('r1', 6, 'Beklemede', 'u-2', 1)] });
    await ui.run('dgUserPubOpen(11)');
    await ui.run('dgUserCancel("r1")');
    const upd = ui.calls.filter((c) => c[0] === 'report_requests' && c[1] === 'update');
    assert.equal(upd.length, 1, 'update çağrıldı');
    assert.equal(upd[0][2][0].status, 'Vazgeçildi');
    assert.ok(upd[0][2][0].cancelled_at, 'iptal zamanı yazılır');
    assert.match(ui.lastToast()[0], /İstek iptal edildi/);
  });

  test('yayınlandı: 🔗 Aç + 📤 Paylaş + 📄 Yeni sürüm + kalıcı bağlantı', async () => {
    const ui = bootUser({
      requests: [REQ('r0', 6, 'Beklemede', 'u-2', 30)],
      queue: { schema: 'dendrogeo-publish-queue/1', entries: [{ request_id: 'r0', park_id: 6, status: 'Yayınlandı', report_id: 'DGR-2026-0007', url_path: '/rapor/DGR-2026-0007/', finished_at: '2026-09-28T10:00:00Z', n: 9, carbon_txt: '5 t' }] },
    });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.match(h, /badge on">Yayınlandı/);
    assert.match(h, /dgReportOpen\('DGR-2026-0007'\)/);
    assert.match(h, /dgReportShare\('DGR-2026-0007'\)/);
    assert.match(h, /📄 Yeni sürüm/, 'yeni çözümleme yeni kimlik');
    assert.ok(h.includes('https://dendrogeo.org/rapor/DGR-2026-0007/'), 'bağlantı kimlikten kuruldu');
    assert.ok(!/dgUserCancel/.test(h), 'sonuçlanmış istekte iptal yok');
  });

  test('⭐ oynanmış günlük dış bağlantı sokamaz (url_path ve bozuk kimlik)', async () => {
    const ui = bootUser({
      requests: [REQ('r0', 6, 'Beklemede', 'u-2', 30)],
      queue: { schema: 'dendrogeo-publish-queue/1', entries: [{ request_id: 'r0', park_id: 6, status: 'Yayınlandı', report_id: 'DGR-2026-0007', url_path: 'http://evil.example/tuzak' }] },
    });
    await ui.run('dgUserPubOpen(11)');
    assert.ok(!/evil\.example/.test(ui.html()), 'url_path sızmadı');
    ui.setQueue({ schema: 'dendrogeo-publish-queue/1', entries: [{ request_id: 'r0', park_id: 6, status: 'Yayınlandı', report_id: 'javascript:alert(1)', url_path: 'http://evil.example' }] });
    await ui.run('dgUserPubRefresh()');
    const h = ui.html();
    assert.ok(!/javascript:/.test(h) && !/evil/.test(h), 'kimlik biçimi bozuksa bağlantı hiç kurulmaz');
    assert.match(h, /badge off">Yayın yok/, 'güvenli tarafa düşer');
  });

  test('başarısız iş: ⚠ neden + yeniden istek düğmesi', async () => {
    const ui = bootUser({
      requests: [REQ('r5', 6, 'Beklemede', 'u-2', 60)],
      queue: { schema: 'dendrogeo-publish-queue/1', entries: [{ request_id: 'r5', park_id: 6, status: 'Başarısız', message: 'OSM/Overpass erişilemedi' }] },
    });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.match(h, /badge off">Başarısız/);
    assert.match(h, /OSM\/Overpass erişilemedi/, 'günlükteki neden görünür');
    assert.match(h, /dgUserPublish\(6\)/, 'yeniden istek açılabilir');
  });

  test('⭐ insert gövdesi: park, LULC, requested_by=USER.id, proje notu, RLS-safe başlıklar', async () => {
    const ui = bootUser();
    await ui.run('dgUserPubOpen(11)');
    await ui.run('dgUserPublish(6)');
    assert.equal(ui.fetches.length, 1);
    const f = ui.fetches[0];
    assert.equal(f.url, 'https://x.supabase.co/rest/v1/report_requests');
    assert.equal(f.headers['Prefer'], 'return=minimal', 'RETURNING politikaya takılmasın');
    assert.equal(f.headers['Authorization'], 'Bearer tok-1', 'oturum anahtarı (anon istek açamaz)');
    assert.deepEqual(f.body, [{ park_id: 6, with_lulc: true, status: 'Beklemede', requested_by: 'u-2', note: 'kullanıcı yayını (proje #11)' }]);
    assert.match(ui.lastToast()[0], /kuyruğa alındı/);
    assert.equal(ui.lastToast()[1], 'ok');
  });

  test('sunucu hataları kullanıcı diline çevrilir (kota/mülkiyet/veri/çift istek)', async () => {
    const err = (msg, code, status) => ({ status: status || 400, text: JSON.stringify({ message: msg, code }) });
    const cases = [
      [err('REPORT_QUOTA (DGR0QT): 24 saatlik yayın isteği sınırına (3) ulaşıldı', 'DG0QT'), /sınırına ulaştın \(24 saatte 3\)/],
      [err('REPORT_NOT_YOUR_PARK (DGR0NP): park 6 için projen yok', 'DG0NP'), /kendi parkının raporunu/],
      [err('REPORT_NO_OWN_DATA (DGR0ND): bu parkta onaylı ölçümün yok', 'DG0ND'), /onaylı ölçümün yok/],
      [err('REPORT_NOT_SELF (DGR0NS): yayın isteği yalnız kendi adına', 'DG0NS'), /kendi adına/],
      [err('duplicate key value violates unique constraint "report_requests_one_pending_per_park"', '23505'), /bekleyen bir istek zaten var/],
      [err('no rows affected by row-level security policy', '42501', 403), /Yetki yok/],
    ];
    for (const [post, re] of cases) {
      const ui = bootUser();
      await ui.run('dgUserPubOpen(11)');
      ui.setPost(post);
      await ui.run('dgUserPublish(6)');
      assert.match(ui.lastToast()[0], re, 'eşleme: ' + post.text.slice(0, 60));
      assert.equal(ui.lastToast()[1], 'err');
    }
  });

  test('0009 uygulanmamışsa panel yapılacak işi söylüyor (sessiz ölüm yok)', async () => {
    const ui = bootUser({ reqError: { code: '42P01', message: 'relation "report_requests" does not exist' } });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.match(h, /alert warn/);
    assert.match(h, /0008_report_publish\.sql/);
    assert.match(h, /0009_user_report_publish\.sql/);
  });

  test('onaylı ölçümü görünmeyen kullanıcı uyarılır (karar yine sunucunun)', async () => {
    const ui = bootUser({ ownApproved: 0 });
    await ui.run('dgUserPubOpen(11)');
    const h = ui.html();
    assert.match(h, /alert warn/, 'uyarı kutusu');
    assert.match(h, /onaylı ölçümün görünmüyor/);
    assert.match(h, /dgUserPublish\(6\)/, 'düğme kalır: başka projesindeki onaylı veri de yeter');
  });

  test('yönetici kartının kapısı değişmedi: kullanıcı dgPublishReport çağıramaz', async () => {
    const ui = bootUser();
    await ui.run('dgPublishReport(6)');
    assert.equal(ui.fetches.length, 0, 'istemci kapısı isteği göndermedi');
    assert.equal(ui.lastToast()[1], 'err');
    /* yönetici aynı çekirdekle yazar (ortak dgPubInsertRequest) */
    const adm = bootUser({ profile: { id: 'u-1', role: 'owner' } });
    await adm.run('dgPublishReport(6)');
    assert.equal(adm.fetches.length, 1);
    assert.equal(adm.fetches[0].body[0].note, 'uygulama içi yayın');
  });

  test('panel HTML’i yalnız mevcut sınıf ailelerini kullanır (yeni CSS yok)', async () => {
    const izin = new Set(['shead', 'no', 'rule', 'badge', 'on', 'off', 'admin', 'btn', 'sm', 'ghost', 'blue', 'red', 'amber', 'alert', 'warn', 'err', 'info', 'dg-tree-meta', 'dg-parkadmin-note', 'mono', 'dg-act']);
    const states = [
      {},
      { requests: [REQ('r1', 6, 'Beklemede', 'u-2', 2)] },
      { requests: [REQ('r9', 6, 'Beklemede', 'u-9', 2)] },
      { requests: [REQ('r0', 6, 'Beklemede', 'u-2', 2)], queue: { schema: 'dendrogeo-publish-queue/1', entries: [{ request_id: 'r0', park_id: 6, status: 'Yayınlandı', report_id: 'DGR-2026-0007' }] } },
      { ownApproved: 0 },
      { reqError: { code: '42P01', message: 'x' } },
    ];
    for (const o of states) {
      const ui = bootUser(o);
      await ui.run('dgUserPubOpen(11)');
      for (const m of ui.html().matchAll(/class="([^"]+)"/g))
        for (const c of m[1].split(/\s+/).filter(Boolean))
          assert.ok(izin.has(c), 'bilinmeyen sınıf: ' + c);
    }
  });

  test('dgUserPubSync: projesi silinen panel kapanır (hayalet durum yok)', async () => {
    const ui = bootUser();
    await ui.run('dgUserPubOpen(11)');
    assert.ok(ui.html().length > 0);
    ui.run('dgUserPubSync([{id:99,park_id:6}])');
    assert.equal(ui.els.dgUserPubBox.style.display, 'none', 'kutu gizlendi');
    assert.equal(ui.els.dgUserPubBox.innerHTML, '', 'içerik temizlendi');
  });
});
