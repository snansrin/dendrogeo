/* park-flow.test.mjs — PARK KİMLİĞİ AKIŞININ UÇTAN UCA ÇALIŞMA ZAMANI TESTİ
 *
 * test/park-identity.test.mjs kuralları ve dosya içeriğini KİLİTLER (statik).
 * Bu dosya ise aynı özelliği GERÇEKTEN ÇALIŞTIRIR: tüm src/* modülleri
 * index.html sırasıyla bir vm bağlamında yüklenir, Supabase sahte bir sorgu
 * kurucuyla, DOM sahte elemanlarla taklit edilir ve akış sürülür:
 *
 *   · v_park_compare satırları → karşılaştırma listesi (3 proje = 1 park satırı)
 *   · park raporu → projects.park_id filtresiyle TÜM projelerin ölçümleri
 *   · ölçüm kapısı → parksız projede saveMeas yazmaz, buton disabled
 *   · proje oluşturma → "Göksu Parkı - deneme"
 *   · park kimliği → aynı park ikinci kez kaydedilmez (ad+konum birleşmesi)
 *   · park algılama ekranı → yönlendirme, adım kartı, bağlama, elle park
 *
 * NEDEN GEREKLİ: bu özellik dört katmana yayılıyor (SQL + registry + measure +
 * world + panel). Statik testler "kod orada duruyor" der; burada "çalışınca
 * doğru şeyi yapıyor" doğrulanır. Sahte Supabase'in davranışı gerçek
 * PostgREST sözleşmesini taklit eder (select→insert, .single(), gömülü !inner).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* =========================================================
   SAHTE SUPABASE
========================================================= */
function makeWorld() {
  const LOG = [];
  const TOASTS = [];
  const GOES = [];
  const TIMERS = [];
  const SS = new Map();
  let ROUTER = () => ({ data: [], error: null });

  /* SAHTE SUPABASE — API BİÇİMİNE SADIK (2026-09-24'te sıkılaştırıldı).
   * İlk sürümde her metod aynı nesnedeydi; bu yüzden `sb.from(t).order(...)`
   * gibi GERÇEKTE OLMAYAN bir zincir testte sessizce geçiyordu ve canlıda
   * yönetim ağacı "⏳ yükleniyor"da asılı kaldı (TypeError: order is not a
   * function). Artık supabase-js sözleşmesi birebir taklit edilir:
   *   from(t)        → yalnız select | insert | update | delete | upsert
   *   select()/...   → filtre kurucusu: eq, order, limit, range, single, …
   * Yanlış zincir testi KIRMIZIYA düşürür. */
  function chain(st) {
    const self = {
      select(c, o) { st.select = c; if (o && o.count) st.count = o.count; return self; },
      eq(k, v) { st.filters.push({ op: 'eq', k, v }); return self; },
      neq(k, v) { st.filters.push({ op: 'neq', k, v }); return self; },
      gt(k, v) { st.filters.push({ op: 'gt', k, v }); return self; },
      gte(k, v) { st.filters.push({ op: 'gte', k, v }); return self; },
      lt(k, v) { st.filters.push({ op: 'lt', k, v }); return self; },
      lte(k, v) { st.filters.push({ op: 'lte', k, v }); return self; },
      is(k, v) { st.filters.push({ op: 'is', k, v }); return self; },
      in(k, v) { st.filters.push({ op: 'in', k, v }); return self; },
      ilike(k, v) { st.filters.push({ op: 'ilike', k, v }); return self; },
      order(k, o) { st.order = [k, o]; return self; },
      limit(n) { st.limit = n; return self; },
      range(a, b) { st.range = [a, b]; return self; },
      single() { st.single = true; return self; },
      maybeSingle() { st.single = true; return self; },
      then(res, rej) {
        st.table = st.table || table0;
        try { LOG.push(JSON.parse(JSON.stringify({ ...st }))); } catch (e) { LOG.push({ ...st }); }
        Promise.resolve().then(() => ROUTER(st)).then(res, rej);
      },
    };
    return self;
  }
  let table0 = null;
  function fromTable(table) {
    table0 = table;
    const st0 = { table, filters: [], op: 'select' };
    return {
      select: (c, o) => { const st = { ...st0, select: c }; if (o && o.count) st.count = o.count; return chain2(table, st); },
      insert: (rows) => chain2(table, { ...st0, op: 'insert', rows }),
      update: (patch) => chain2(table, { ...st0, op: 'update', patch }),
      upsert: (rows, o) => chain2(table, { ...st0, op: 'upsert', rows, onConflict: o }),
      delete: () => chain2(table, { ...st0, op: 'delete' }),
    };
  }
  function chain2(table, st) {
    const self = chain(st);
    st.table = table;
    return self;
  }

  /* Sahte auth: OAuth akışının test edilebilmesi için signInWithOAuth
   * çağrılarını kaydeder, onAuthStateChange dinleyicilerini dışarı verir. */
  const AUTH = { session: null, listeners: [], oauth: [], oauthError: null, signups: [], signupError: null };
  const sbStub = {
    from: (t) => fromTable(t),
    storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }), remove: async () => ({}) }) },
    auth: {
      getSession: async () => ({ data: { session: AUTH.session } }),
      onAuthStateChange: (cb) => { AUTH.listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithOAuth: async (o) => { AUTH.oauth.push(o); return { data: {}, error: AUTH.oauthError }; },
      signUp: async (o) => { AUTH.signups.push(o); return { data: { user: { id: 'yeni' } }, error: AUTH.signupError }; },
      signOut: async () => ({ error: null }),
    },
  };

  /* ---------- sahte DOM ---------- */
  const els = new Map();
  const mkEl = (id) => ({
    id, innerHTML: '', textContent: '', value: '', className: '', disabled: false,
    style: {}, dataset: {}, checked: false, files: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    scrollIntoView() {}, appendChild() {}, remove() {}, setAttribute() {}, focus() {}, blur() {},
    addEventListener() {}, querySelectorAll: () => [], offsetWidth: 0,
  });
  const document = {
    getElementById: (id) => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
    createElement: () => mkEl('dyn'),
    querySelectorAll: () => [],
    addEventListener() {},
    head: mkEl('head'), body: mkEl('body'), documentElement: mkEl('html'),
    readyState: 'complete', visibilityState: 'visible',
  };

  const ctx = {
    window: null, document,
    navigator: { onLine: true, userAgent: 'test', geolocation: null, permissions: null, storage: null },
    location: { hash: '', search: '', origin: 'https://dendrogeo.org', pathname: '/', assign() {}, replace() {} },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: {
      getItem: (k) => (SS.has(String(k)) ? SS.get(String(k)) : null),
      setItem: (k, v) => SS.set(String(k), String(v)),
      removeItem: (k) => SS.delete(String(k)),
    },
    indexedDB: null, caches: null,
    L: {
      map: () => ({ setView() {}, fitBounds() {}, on() {}, invalidateSize() {}, addLayer() {}, removeLayer() {}, hasLayer: () => false }),
      tileLayer: () => ({ addTo: () => {} }),
      latLngBounds: () => ({ pad: () => ({}), isValid: () => true, extend() {} }),
      polygon: () => ({ addTo: () => {} }), polyline: () => ({ addTo: () => {} }),
      circleMarker: () => ({ addTo: () => {} }),
      layerGroup: () => ({ addTo: () => ({ clearLayers() {} }), clearLayers() {} }),
    },
    Chart: function () {}, supabase: { createClient: () => sbStub }, GeoTIFF: null,
    alert: () => {}, confirm: () => true, prompt: (m, d) => (ctx.__prompt === undefined ? d : ctx.__prompt),
    console: { log() {}, warn() {}, error() {} },
    /* setTimeout KUYRUĞA yazar: auth.js'teki turnstile retry döngüsü senkron
     * çalıştırılırsa yığın taşar. flush() ile elle boşaltılır. */
    setTimeout: (f) => { TIMERS.push(f); return TIMERS.length; },
    clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    URL, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date, Number, Array,
    Object, String, Boolean, Promise, RegExp, Error, Intl, isNaN, parseInt, parseFloat,
    TextEncoder, TextDecoder, AbortController, Image: function () {},
    fetch: () => Promise.reject(new Error('test: ağ yok')),
    addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.__toasts = TOASTS; ctx.__goes = GOES;
  vm.createContext(ctx);

  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="(src\/[^"?]+)[^>]*><\/script>/g)].map((m) => m[1]);
/* LULC zinciri tembel yüklendiği için index.html'de yok; ağaç/karşılaştırma
 * testleri onu gerektirmiyor ama facade'ı kullanan akışlar için yüklüyoruz. */
scripts.push('src/services/lc-config.js', 'src/services/lc-geo.js', 'src/services/lc-stac.js',
  'src/services/lc-engine.js', 'src/services/lc-osm.js', 'src/services/lc-patches.js',
  'src/ui/lc-report.js', 'src/services/landcover.js');
  for (const f of scripts) {
    vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  /* boot() oturumsuz erken döner; test kabuğu kendi kurar. */
  vm.runInContext('toast=(m,t,i)=>{ __toasts.push([String(m),t||"ok",i||""]); };', ctx);
  vm.runInContext('go=(v)=>{ __goes.push(v); };', ctx);
  vm.runInContext('USER={id:"u-1"}; PROFILE={id:"u-1",role:"owner",full_name:"Test"};', ctx);
  vm.runInContext('map={setView(){},fitBounds(){},invalidateSize(){},on(){}};', ctx);
  vm.runInContext('reverseGeocode=async()=>({city:"Ankara",country:"Türkiye"});', ctx);
  vm.runInContext('calc=(d,h,sp,gr)=>({total_carbon:123.4,agb:200,bhb:52,vol:1.1});', ctx);

  return {
    ctx, LOG, TOASTS, GOES, AUTH,
    el: (id) => document.getElementById(id),
    run: (code) => vm.runInContext(code, ctx),
    flush: (max = 20) => { let n = 0; while (TIMERS.length && n < max) { const f = TIMERS.shift(); n++; try { if (typeof f === 'function') f(); } catch (e) {} } TIMERS.length = 0; },
    route: (fn) => { ROUTER = fn; },
    reset: () => { LOG.length = 0; TOASTS.length = 0; GOES.length = 0; },
  };
}

const W = makeWorld();
const { el, run, LOG, TOASTS, GOES } = W;
const lastInsert = (t) => LOG.filter((l) => l.table === t && l.op === 'insert').pop();
const lastUpdate = (t) => LOG.filter((l) => l.table === t && l.op === 'update').pop();

/* =========================================================
   1) KARŞILAŞTIRMA — PARK BAZLI
========================================================= */
describe('Park Karşılaştırma — Karbon Performansı (park bazlı)', () => {
  /* describe gövdeleri dosya yüklenirken çalışır, testler SONRA — bu yüzden
   * tüm kurulum before() içinde: aksi hâlde son bölümün yönlendiricisi
   * diğer bölümlerin üzerine yazardı. */
  before(() => W.route((st) => st.table === 'v_park_compare' ? {
    data: [
      { park_id: 7, park_name: 'Göksu Parkı', city: 'Ankara', country: 'Türkiye', records: 148, projects: 3, contributors: 3, carbon_kg: 12450.5, avg_dbh: 24.1, avg_height: 8.2, species_n: 7, area_m2: 423000, centroid_lat: 39.98, centroid_lon: 32.65, park_pending: false },
      { park_id: 9, park_name: 'Eymir Gölü Parkı', city: 'Ankara', country: 'Türkiye', records: 40, projects: 1, contributors: 1, carbon_kg: 3100, avg_dbh: 18, avg_height: 6, species_n: 3, area_m2: 0, park_pending: false },
      { park_id: 0, park_name: 'Eski Proje X', city: 'Ankara', country: 'Türkiye', records: 12, projects: 1, contributors: 1, carbon_kg: 900, avg_dbh: 20, avg_height: 7, species_n: 2, area_m2: null, park_pending: true },
    ], error: null,
  } : { data: [], error: null }));

  test('liste view satırlarından üretilir', async () => {
    await run('loadParkCompare()');
    const cmp = el('parkCompare').innerHTML;
    assert.ok(cmp.includes('Göksu Parkı'), 'park adı yok');
    assert.ok(cmp.includes('Eymir Gölü Parkı'), 'ikinci park yok');
  });

  test('⭐ 3 kişinin çalıştığı park TEK satır (proje adları görünmez)', () => {
    const cmp = el('parkCompare').innerHTML;
    assert.equal((cmp.match(/Göksu Parkı/g) || []).length, 1, 'park adı birden çok kez geçiyor');
    assert.ok(cmp.includes('👥 3 kişi'), 'katkıda bulunan sayısı yok');
    assert.ok(cmp.includes('📁 3 proje'), 'proje sayısı yok');
    assert.ok(cmp.includes('148 kayıt'), 'kayıt sayısı yok');
  });

  test('alan bilgisi ve t/ha yoğunluğu gösterilir', () => {
    const cmp = el('parkCompare').innerHTML;
    assert.ok(cmp.includes('42.3 ha'), 'hektar yok');
    assert.ok(cmp.includes('t/ha'), 'karbon yoğunluğu yok');
    assert.ok(cmp.includes('🏆 En İyi'), 'lider rozeti yok');
  });

  test('parkı olmayan eski kayıtlar AYRI bölümde (veri kaybolmaz)', () => {
    const cmp = el('parkCompare').innerHTML;
    assert.ok(cmp.includes('PARK ALGILANMAMIŞ KAYITLAR'));
    assert.ok(cmp.includes('Eski Proje X'));
    assert.ok(cmp.indexOf('PARK ALGILANMAMIŞ') > cmp.indexOf('🏆 En İyi'), 'sıralamadan sonra gelmeli');
  });

  test('rapor seçeneği park kimliği taşır', () => {
    const opts = el('repProject').innerHTML;
    assert.ok(opts.includes('value="7"') && opts.includes('🌳 Göksu Parkı'), opts);
    assert.ok(opts.includes('proj:Eski Proje X'), 'parksız kayıt için proj: öneki');
  });

  test('şema eskiyse proje bazlı yedeğe düşer + migration’ı söyler', async () => {
    W.route((st) => st.table === 'v_park_compare'
      ? { data: null, error: { message: 'relation "public.v_park_compare" does not exist' } }
      : (st.table === 'measurements'
        ? { data: [{ carbon_kg: 100, dbh_cm: 20, height_m: 7, species: 'Meşe', grp: 'YAPRAKLI', projects: { name: 'Eski Proje', city: 'Ankara' } }], count: 1, error: null }
        : { data: [], error: null }));
    await run('loadParkCompare()');
    const cmp = el('parkCompare').innerHTML;
    assert.ok(cmp.includes('Veritabanı şeması eski'), 'yedek modu uyarısı yok');
    assert.ok(cmp.includes('0004_parks.sql'), 'migration adı söylenmeli');
    assert.ok(cmp.includes('Eski Proje'), 'yedek listede proje adı olmalı');
    /* Şema bayrağı diğer akışları da etkiler → geri al */
    run('DG_PARK_SCHEMA_OK=true; DG_PARK_SCHEMA_WARNED=false;');
  });
});

/* =========================================================
   2) PARK RAPORU — park_id filtresi
========================================================= */
describe('park raporu tüm projeleri parkta birleştirir', () => {
  test('sorgu projects.park_id + !inner ile gider', async () => {
    W.reset();
    run('PARK_ROWS=[{park_id:7,park_name:"Göksu Parkı",city:"Ankara",area_m2:423000,contributors:3}]');
    el('repProject').value = '7';
    W.route((st) => st.table === 'measurements' ? {
      data: [
        { carbon_kg: 100, dbh_cm: 20, height_m: 7, species: 'Meşe', grp: 'YAPRAKLI', point_id: 1, projects: { name: 'Göksu Parkı - deneme', city: 'Ankara', park_id: 7, park_name: 'Göksu Parkı' } },
        { carbon_kg: 200, dbh_cm: 30, height_m: 9, species: 'Çam', grp: 'İBRELİ', point_id: 2, projects: { name: 'Göksu Parkı - kuzey', city: 'Ankara', park_id: 7, park_name: 'Göksu Parkı' } },
      ], count: 2, error: null,
    } : { data: [], error: null });
    await run('parkReport()');
    const q = LOG.find((l) => l.table === 'measurements');
    assert.ok(q.filters.some((f) => f.k === 'projects.park_id' && f.v === 7), JSON.stringify(q.filters));
    assert.ok(String(q.select).includes('projects!inner('), 'PostgREST filtresi inner join ister');
  });

  test('rapor iki projeyi tek parkta toplar', () => {
    const pv = el('pvBody').innerHTML;
    assert.ok(pv.includes('2 proje') && pv.includes('Göksu Parkı - deneme') && pv.includes('Göksu Parkı - kuzey'));
    assert.ok(el('pvTitle').textContent.includes('Göksu Parkı — Park Raporu'));
    assert.ok(pv.includes('t/ha'), 'alan yoğunluğu raporda');
  });
});

/* =========================================================
   3) ÖLÇÜM KAPISI
========================================================= */
describe('ölçüm kapısı: park algılanmadan ölçüm yok', () => {
  before(() => {
    run(`PROJ_LIST=[
     {id:1,name:"Göksu Parkı - deneme",park_id:7,park_name:"Göksu Parkı",label:"deneme",parks:{id:7,name:"Göksu Parkı",area_m2:423000}},
     {id:2,name:"Eski Proje",park_id:null,parks:null}];`);
    run('EDIT_ID=null; GPS={latitude:39.98,longitude:32.65,accuracy:5,altitude:900}; DG_PARK_SCHEMA_OK=true;');
  });

  test('parklı proje → kapı açık, buton etkin', () => {
    el('mProject').value = '1';
    run('dgParkGate()');
    assert.equal(el('parkGate').className, 'alert ok');
    assert.equal(el('saveBtn').disabled, false);
    assert.ok(el('parkGate').innerHTML.includes('Göksu Parkı - deneme'));
    assert.ok(el('parkGate').innerHTML.includes('42.3 ha'));
  });

  test('⭐ parksız proje → kapı kapalı, buton kilitli, yönlendirme var', () => {
    el('mProject').value = '2';
    run('dgParkGate()');
    assert.equal(el('parkGate').className, 'alert err');
    assert.equal(el('saveBtn').disabled, true);
    assert.ok(el('parkGate').innerHTML.includes('startParkScan({projectId:2'), 'yönlendirme projeyi taşımalı');
  });

  test('proje seçilmemişse park algılama ekranına gönderir', () => {
    el('mProject').value = '';
    run('dgParkGate()');
    assert.equal(el('parkGate').className, 'alert err');
    assert.ok(el('parkGate').innerHTML.includes('Park Algılama Ekranına Git'));
  });

  test('⭐ saveMeas parksız projede HİÇBİR ŞEY yazmaz', async () => {
    el('mProject').value = '2'; el('mPoint').value = '5'; el('mNo').value = '1';
    el('mSpecies').value = 'Meşe'; el('mGroup').value = 'YAPRAKLI';
    el('mDbh').value = '20'; el('mHeight').value = '7';
    W.reset();
    W.route(() => ({ data: [], error: null }));
    await run('saveMeas()');
    assert.ok(!LOG.some((l) => l.table === 'measurements' && l.op === 'insert'), 'ölçüm yazılmamalıydı');
    assert.ok(TOASTS.some((t) => t[0].includes('park algılanmadı')), JSON.stringify(TOASTS));
  });

  test('parklı projede ölçüm gider ve satıra park_id yazılır', async () => {
    el('mProject').value = '1'; el('mPhoto').files = [];
    run('photoOk=true;');
    W.reset();
    W.route(() => ({ data: [], error: null }));
    await run('saveMeas()');
    const ins = lastInsert('measurements');
    assert.ok(ins, 'insert yok: ' + JSON.stringify(LOG.map((l) => l.table + ':' + l.op)));
    assert.equal(ins.rows.park_id, 7);
    assert.equal(ins.rows.project_id, 1);
    assert.equal(ins.rows.carbon_kg, 123.4);
  });

  test('⭐ ölçüm sekmesi açılınca parksız proje doğrudan algılamaya yönlendirilir', () => {
    el('mProject').value = '2';
    W.reset();
    run('dgParkGate(true)');
    assert.ok(GOES.includes('map'), 'park algılama ekranına gitmeli: ' + JSON.stringify(GOES));
    assert.equal(el('parkGate').className, 'alert err');
  });

  test('yönlendirme proje başına BİR KEZ (kapan döngüsü olmaz)', () => {
    el('mProject').value = '2';
    W.reset();
    run('dgParkGate(true)');
    assert.ok(!GOES.includes('map'), 'ikinci kez fırlatmamalı: ' + JSON.stringify(GOES));
    assert.equal(el('parkGate').className, 'alert err', 'banner yine görünür olmalı');
  });

  test('sekme açılışı dışındaki çağrılar yönlendirmez (banner yeter)', () => {
    el('mProject').value = '2';
    W.reset();
    run('dgParkGate()');
    assert.ok(!GOES.length, JSON.stringify(GOES));
  });

  test('düzenleme modu kapıdan etkilenmez (mevcut kayıt güncellenir)', () => {
    run('EDIT_ID=99;');
    el('mProject').value = '2';
    run('dgParkGate()');
    assert.equal(el('saveBtn').disabled, false);
    assert.equal(el('parkGate').style.display, 'none');
    run('EDIT_ID=null;');
  });

  test('şema eskiyse kapı ölçümü KİLİTLEMEZ (kullanıcı çalışamaz kalmasın)', () => {
    run('DG_PARK_SCHEMA_OK=false; DG_PARK_SCHEMA_WARNED=false;');
    el('mProject').value = '2';
    run('dgParkGate()');
    assert.equal(el('saveBtn').disabled, false);
    assert.equal(el('parkGate').className, 'alert warn');
    assert.ok(el('parkGate').innerHTML.includes('0004_parks.sql'));
    run('DG_PARK_SCHEMA_OK=true;');
  });
});

/* =========================================================
   4) PROJE = PARK + ETİKET
========================================================= */
describe('proje adı "park - etiket" kuralıyla kurulur', () => {
  test('önizleme ve insert aynı adı üretir', async () => {
    run('DG_PARK={id:7,name:"Göksu Parkı",osm_key:"way/123",area_m2:423000,city:"Ankara",country:"Türkiye"};');
    el('pLabel').value = 'deneme';
    run('dgProjectNamePreview()');
    assert.equal(el('pNamePreview').textContent, 'Göksu Parkı - deneme');

    el('pCountry').value = ''; el('pCity').value = '';
    W.reset();
    W.route(() => ({ data: [], error: null }));
    await run('createProject()');
    const ins = lastInsert('projects');
    assert.ok(ins, 'proje insert edilmedi');
    assert.equal(ins.rows.name, 'Göksu Parkı - deneme');
    assert.equal(ins.rows.park_id, 7);
    assert.equal(ins.rows.label, 'deneme');
  });

  test('etiket boşsa ad = park adı', () => {
    el('pLabel').value = '';
    run('dgProjectNamePreview()');
    assert.equal(el('pNamePreview').textContent, 'Göksu Parkı');
  });

  test('⭐ park algılanmadan proje açılamaz → algılamaya yönlendirir', async () => {
    run('DG_PARK=null; DG_PARK_SCHEMA_OK=true;');
    W.reset();
    W.route(() => ({ data: [], error: null }));
    await run('createProject()');
    assert.ok(!LOG.some((l) => l.table === 'projects' && l.op === 'insert'));
    assert.ok(TOASTS.some((t) => t[0].includes('park olmadan proje açılamaz')), JSON.stringify(TOASTS));
    assert.ok(GOES.includes('map'), 'park algılama ekranına gitmeli: ' + JSON.stringify(GOES));
  });
});

/* =========================================================
   5) PARK KİMLİĞİ TEKİLLEŞMESİ
========================================================= */
describe('aynı parkı 3 kişi algılarsa TEK kimlik', () => {
  let parks = [];
  const routeParks = () => W.route((st) => {
    if (st.table === 'parks' && st.op === 'insert') {
      const row = { id: 99, ...st.rows };
      parks.push(row);
      return { data: row, error: null };
    }
    if (st.table === 'parks') {
      const key = (st.filters.find((f) => f.k === 'osm_key') || {}).v;
      let rows = parks;
      if (key) rows = rows.filter((p) => p.osm_key === key);
      for (const f of st.filters) {
        if (f.k === 'centroid_lat') rows = rows.filter((p) => (f.op === 'gte' ? p.centroid_lat >= f.v : p.centroid_lat <= f.v));
        if (f.k === 'centroid_lon') rows = rows.filter((p) => (f.op === 'gte' ? p.centroid_lon >= f.v : p.centroid_lon <= f.v));
      }
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  });

  test('aynı OSM elemanı → mevcut satır, insert YOK', async () => {
    parks = [{ id: 7, osm_key: 'way/123', name: 'Göksu Parkı', name_norm: 'goksu parki', area_m2: 423000, city: 'Ankara', country: 'Türkiye', centroid_lat: 39.98, centroid_lon: 32.65, source: 'osm' }];
    routeParks();
    run('DG_PARK_SESSION.clear(); DG_PARK_SCHEMA_OK=true;');
    W.reset();
    const got = await run('dgRegisterPark({name:"Göksu Parkı",type:"way",id:123,area:423000},{lat:39.98,lon:32.65})');
    assert.equal(got.id, 7);
    assert.ok(!LOG.some((l) => l.table === 'parks' && l.op === 'insert'), 'yeni kimlik açılmamalıydı');
    assert.equal(parks.length, 1);
  });

  test('⭐ farklı OSM tipi/id ama aynı ad + yakın konum → yine #7', async () => {
    run('DG_PARK_SESSION.clear();');
    W.reset();
    const got = await run('dgRegisterPark({name:"GÖKSU PARKI",type:"relation",id:555,area:420000},{lat:39.9805,lon:32.6505})');
    assert.equal(got.id, 7, JSON.stringify(got));
    assert.equal(parks.length, 1);
  });

  test('uzaktaki aynı ad AYRI park olur (iki farklı Göksu Parkı)', async () => {
    run('DG_PARK_SESSION.clear();');
    const got = await run('dgRegisterPark({name:"Göksu Parkı",type:"way",id:999,area:10000},{lat:41.01,lon:28.98})');
    assert.equal(got.id, 99);
    assert.equal(got.osm_key, 'way/999');
    assert.equal(parks.length, 2);
  });

  test('⚠ upsert kullanılmaz (RLS: başkasının park satırını yazma yetkisi yok)', () => {
    const src = readFileSync(join(ROOT, 'src/services/park-registry.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function dgRegisterPark'), src.indexOf('async function dgDetectAt'));
    assert.ok(!/\.upsert\(/.test(fn), 'upsert RLS update politikasına takılır');
    assert.ok(fn.includes('23505'), 'yarış durumu ele alınmalı');
  });

  test('şema eskiyse kimlik yazmaya hiç kalkışmaz', async () => {
    run('DG_PARK_SCHEMA_OK=false; DG_PARK_SESSION.clear();');
    W.reset();
    const got = await run('dgRegisterPark({name:"X",type:"way",id:1,area:1000},{lat:1,lon:1})');
    assert.equal(got, null);
    assert.equal(LOG.length, 0);
    run('DG_PARK_SCHEMA_OK=true;');
  });
});

/* =========================================================
   6) PARK ALGILAMA EKRANI AKIŞI
========================================================= */
describe('park algılama ekranı: yönlendirme → kimlik → proje', () => {
  const GOKSU = { id: 7, osm_key: 'way/123', name: 'Göksu Parkı', name_norm: 'goksu parki', area_m2: 423000, city: 'Ankara', country: 'Türkiye', centroid_lat: 39.982, centroid_lon: 32.655, source: 'osm' };
  let parks = [GOKSU];
  let nextId = 42;

  /* Bölüm 6 yönlendiricisi: parks + projects + measurements */
  before(() => {
  W.route((st) => {
    if (st.table === 'parks') {
      if (st.op === 'insert') { const row = { id: nextId++, ...st.rows }; parks.push(row); return { data: row, error: null }; }
      const key = (st.filters.find((f) => f.k === 'osm_key') || {}).v;
      let rows = parks;
      if (key) rows = rows.filter((p) => p.osm_key === key);
      for (const f of st.filters) {
        if (f.k === 'centroid_lat') rows = rows.filter((p) => (f.op === 'gte' ? p.centroid_lat >= f.v : p.centroid_lat <= f.v));
        if (f.k === 'centroid_lon') rows = rows.filter((p) => (f.op === 'gte' ? p.centroid_lon >= f.v : p.centroid_lon <= f.v));
      }
      return { data: rows, error: null };
    }
    if (st.table === 'projects' && st.op === 'select') return {
      data: [
        { id: 2, name: 'Göksu Parkı - Eski Proje', park_id: 7, park_name: 'Göksu Parkı', label: 'Eski Proje', created_at: '2026-08-01', parks: { id: 7, name: 'Göksu Parkı', area_m2: 423000 } },
        { id: 5, name: 'Göksu Parkı - deneme', park_id: 7, park_name: 'Göksu Parkı', label: 'deneme', created_at: '2026-09-01', parks: { id: 7, name: 'Göksu Parkı', area_m2: 423000 } },
      ], error: null,
    };
    if (st.table === 'projects' && st.op === 'update') return { data: { id: 2, name: 'Göksu Parkı - Eski Proje', ...st.patch }, error: null };
    if (st.table === 'projects' && st.op === 'insert') return { data: { id: nextId++, ...st.rows }, error: null };
    return { data: [], error: null };
  });

  run(`queryPark=async(lat,lon)=>([{name:"Göksu Parkı",type:"way",id:123,area:423000,
    rings:[[[39.980,32.650],[39.985,32.650],[39.985,32.660],[39.980,32.660],[39.980,32.650]]]}]);`);
  run('drawPark=async(p)=>{ return dgOnParkDrawn(p); };');
  run('DG_PARK=null; DG_PARK_CAND=null; DG_PARK_SESSION.clear(); DG_PARK_SCHEMA_OK=true; DG_PARK_SCAN=false;');
  run(`PROJ_LIST=[{id:2,name:"Eski Proje",park_id:null,parks:null},
                 {id:5,name:"Göksu Parkı - deneme",park_id:7,parks:{id:7,name:"Göksu Parkı",area_m2:423000}}];`);
  });

  test('ölçümden yönlendirme harita sekmesini + adım kartını açar', () => {
    W.reset();
    run('startParkScan({projectId:2,returnTo:"measure"})');
    W.flush();
    assert.ok(GOES.includes('map'), JSON.stringify(GOES));
    assert.equal(el('parkScanCard').style.display, 'block');
    const card = el('parkScanCard').innerHTML;
    assert.ok(card.includes('parkın içine tıkla'), 'adım 1 açıklaması yok');
    assert.ok(card.includes('dgDetectAtMyLocation()'), 'konumdan algılama butonu yok');
    assert.ok(card.includes('dgShowManualParkForm()'), 'elle oluşturma çıkışı yok');
  });

  test('⭐ GPS’ten algılama parkı kimliğe yazar (yeni satır açmaz)', async () => {
    run('GPS={latitude:39.982,longitude:32.655,accuracy:6,altitude:900};');
    W.reset();
    await run('dgDetectAtMyLocation()');
    const park = run('DG_PARK');
    assert.ok(park && park.id === 7, JSON.stringify(park));
    assert.equal(parks.length, 1, 'aynı park için ikinci kimlik açıldı');
    assert.ok(!LOG.some((l) => l.table === 'parks' && l.op === 'insert'));
  });

  test('kart 3. adıma geçer: kimlik + alan + etiket + bağlama', () => {
    const card = el('parkScanCard').innerHTML;
    assert.equal((card.match(/dg-scan-step on/g) || []).length, 3, 'üç adım da açık olmalı');
    assert.ok(card.includes('way/123') && card.includes('42.3 ha') && card.includes('DB #7'), card.slice(0, 300));
    assert.ok(card.includes('dgScanLinkTarget()'), 'hedef projeye bağlama butonu yok');
    assert.ok(card.includes('value="Eski Proje"'), 'etiket eski adı önermeli (ad kaybolmasın)');
  });

  test('⭐ bağlama: park_id + etiket yazılır, eski ölçümler parklanır', async () => {
    W.reset();
    await run('dgScanLinkTarget()');
    const upd = lastUpdate('projects');
    assert.ok(upd, 'proje güncellenmedi');
    assert.equal(upd.patch.park_id, 7);
    assert.equal(upd.patch.label, 'Eski Proje');
    assert.ok(LOG.some((l) => l.table === 'measurements' && l.op === 'update' && l.patch.park_id === 7),
      'eski ölçümlerin park_id’si doldurulmalı');
    assert.ok(GOES.includes('measure'), 'ölçüm sekmesine dönmeli: ' + JSON.stringify(GOES));
    assert.equal(run('DG_PARK_SCAN'), false, 'akış kapanmalı');
  });

  test('etiket boş bırakılırsa eski ad YİNE korunur (ilk bağlamada)', async () => {
    run('DG_PARK={id:7,name:"Göksu Parkı",osm_key:"way/123",area_m2:423000}; DG_PARK_SCAN=true;');
    run('PROJ_LIST=[{id:3,name:"Kuzey Kesim Envanteri",park_id:null,parks:null}]');
    el('scanLabel').value = '';
    W.reset();
    await run('dgLinkProject(3)');
    const upd = lastUpdate('projects');
    assert.equal(upd.patch.label, 'Kuzey Kesim Envanteri', 'eski ad etikete taşınmalıydı');
  });

  test('karttan yeni proje "Göksu Parkı - deneme" olarak açılır', async () => {
    el('scanLabel').value = 'deneme';
    run('dgScanPreviewName()');
    assert.equal(el('scanNamePreview').textContent, 'Göksu Parkı - deneme');
    W.reset();
    await run('dgScanCreateProject()');
    const ins = lastInsert('projects');
    assert.ok(ins, 'proje oluşturulmadı');
    assert.equal(ins.rows.name, 'Göksu Parkı - deneme');
    assert.equal(ins.rows.park_id, 7);
    assert.equal(ins.rows.label, 'deneme');
  });

  test('kimlik yazılamadıysa proje de açılamaz (yarım veri yok)', async () => {
    run('DG_PARK=null; DG_PARK_CAND={name:"X",type:"way",id:1};');
    W.reset();
    await run('dgScanCreateProject()');
    assert.ok(!LOG.some((l) => l.table === 'projects' && l.op === 'insert'));
    assert.ok(TOASTS.some((t) => t[0].includes('🔄')), JSON.stringify(TOASTS));
  });

  test('OSM’de park yoksa elle oluşturma formu açılır', async () => {
    run('DG_PARK=null; DG_PARK_CAND=null; DG_MANUAL_PENDING=null; DG_PARK_SESSION.clear(); queryPark=async()=>null;');
    W.reset();
    await run('dgDetectAt(40.1,33.2)');
    assert.ok(el('parkScanCard').innerHTML.includes('manualParkName'), 'manuel form açılmadı');
    assert.ok(TOASTS.some((t) => t[0].includes('OSM parkı bulunamadı')), JSON.stringify(TOASTS));
  });

  test('⭐ elle park: manual anahtar + ha→m² + şehir reverseGeocode’dan', async () => {
    run('DG_MANUAL_PENDING={lat:40.1,lon:33.2};');
    el('manualParkName').value = 'Yeni Koru';
    el('manualParkArea').value = '12,5';
    W.reset();
    await run('dgCreateManualPark()');
    const ins = lastInsert('parks');
    assert.ok(ins, 'park kaydı oluşmadı');
    assert.equal(ins.rows.osm_type, 'manual');
    assert.equal(ins.rows.source, 'manual');
    assert.ok(ins.rows.osm_key.startsWith('manual/yeni koru/'), ins.rows.osm_key);
    assert.equal(ins.rows.area_m2, 125000);
    assert.equal(ins.rows.name_norm, 'yeni koru');
  });

  test('grid panelindeki proje listesi parka göre süzülür', () => {
    run(`PROJ_LIST=[{id:5,name:"Göksu Parkı - deneme",park_id:7},{id:2,name:"Eski Proje",park_id:null}]`);
    const opts = run('dgProjectOptionsForPark(7,true)');
    assert.ok(opts.includes('Göksu Parkı - deneme') && !opts.includes('Eski Proje'), opts);
    assert.ok(run('dgProjectOptionsForPark(999,true)').includes('Eski Proje'), 'yedek liste (legacy)');
    assert.ok(run('dgProjectOptionsForPark(999,false)').includes('Bu park için proje yok'), 'yönlendirici mesaj');
  });

  test('clearPark oturum kimliğini düşürür ama akışı bozmaz', () => {
    run('DG_PARK={id:7,name:"Göksu Parkı"};');
    run('dgResetParkIdentity()');
    assert.equal(run('DG_PARK'), null);
    assert.equal(run('DG_PARK_CAND'), null);
  });
});

/* =========================================================
   8) YÖNETİM AĞACI (park → proje → kullanıcı → ölçüm)
========================================================= */
describe('yönetim ağacı tüm veriyi hiyerarşik gösterir', () => {
  const TREEROWS = [
    { id: 1, owner: 'u1', project_id: 10, park_id: 7, carbon_kg: 100, status: 'Onaylı', species: 'Meşe', grp: 'YAPRAKLI', point_id: 1, measurement_no: 1, dbh_cm: 20, height_m: 7, photo_url: null, created_at: '2026-09-01T10:00:00Z',
      profiles: { full_name: 'Ayşe Yılmaz' },
      projects: { id: 10, name: 'Göksu Parkı - deneme', park_id: 7, park_name: 'Göksu Parkı', parks: { id: 7, name: 'Göksu Parkı', area_m2: 508000, city: 'Ankara' } } },
    { id: 2, owner: 'u2', project_id: 11, park_id: 7, carbon_kg: 50, status: 'Beklemede', species: 'Çam', grp: 'İBRELİ', point_id: 2, measurement_no: 1, dbh_cm: 30, height_m: 9, photo_url: null, created_at: '2026-09-02T10:00:00Z',
      profiles: { full_name: 'Burak Demir' },
      projects: { id: 11, name: 'Göksu Parkı - kuzey', park_id: 7, park_name: 'Göksu Parkı', parks: { id: 7, name: 'Göksu Parkı', area_m2: 508000, city: 'Ankara' } } },
    { id: 3, owner: 'u3', project_id: 12, park_id: null, carbon_kg: 20, status: 'Red', species: 'Söğüt', grp: 'DİĞER', point_id: 9, measurement_no: 1, dbh_cm: 12, height_m: 4, photo_url: null, created_at: '2026-08-01T10:00:00Z',
      profiles: { full_name: 'Cem Kaya' },
      projects: { id: 12, name: 'Ülkü', park_id: null, park_name: null, parks: null } },
  ];

  test('⭐ park düğümü → projeler → kullanıcılar → ölçüm satırları', async () => {
    W.route((st) => st.table === 'measurements' ? { data: TREEROWS, count: 3, error: null } : { data: [], error: null });
    run('DG_TREE_STATUS=""; DG_TREE_QUERY=""; DG_TREE_OPEN.clear();');
    await run('loadAdminTree()');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('Göksu Parkı'), 'park düğümü yok');
    assert.ok(h.includes('Göksu Parkı - deneme') && h.includes('Göksu Parkı - kuzey'), 'projeler yok');
    assert.ok(h.includes('Ayşe Yılmaz') && h.includes('Burak Demir'), 'kullanıcılar yok');
    assert.ok(h.includes('approveMeas(1)') || h.includes('rejectMeas(1)'), 'satır işlem düğmeleri yok');
    assert.ok(h.includes('50.8 ha'), 'park alanı yok');
    assert.ok(h.includes('t/ha'), 'karbon yoğunluğu yok');
  });

  test('TÜM durumlar görünüyor (onaylı + bekleyen + red)', async () => {
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('Onay Bekliyor'), 'bekleyen rozeti');
    assert.ok(h.includes('>Red<') || h.includes('Red</span>'), 'red rozeti');
    assert.ok(h.includes('⚠ Park algılanmamış'), 'parksız proje düğümü');
    assert.ok(h.includes('Ülkü'), 'parksız proje adı');
  });

  test('durum filtresi ağacı yeniden çizer', async () => {
    run('dgTreeSetStatus("Red")');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('Ülkü') && !h.includes('Göksu Parkı - deneme'), 'yalnız red kayıtları');
    run('dgTreeSetStatus("")');
  });

  test('arama kullanıcı/tür adıyla süzer', async () => {
    run('dgTreeSetQuery("burak")');
    let h = el('adminTree').innerHTML;
    assert.ok(h.includes('Burak Demir') && !h.includes('Ayşe Yılmaz'), h.slice(0, 200));
    run('dgTreeSetQuery("söğüt")');
    h = el('adminTree').innerHTML;
    assert.ok(h.includes('Söğüt') && !h.includes('Meşe'));
    run('dgTreeSetQuery("")');
  });

  test('⭐ sorgu hatası sessiz "kayıt yok"a dönüşmüyor', async () => {
    W.route(() => ({ data: null, error: { message: 'could not find a relationship between measurements and parks' } }));
    await run('loadAdminTree()');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('Ölçümler okunamadı'), 'hata kutusu yok');
    assert.ok(h.includes('veri silinmedi'), 'kullanıcıya güvence verilmeli');
    assert.ok(h.includes('could not find a relationship'), 'hatanın kendisi görünmeli');
    assert.ok(h.includes('loadAdminTree()'), 'yeniden dene düğmesi');
  });


  test('⭐ onay bekleyen rozeti üç seviyede + yan menüde yanar', async () => {
    W.route((st) => st.table === 'measurements' ? { data: TREEROWS, count: 3, error: null } : { data: [], error: null });
    run('DG_TREE_STATUS=""; DG_TREE_QUERY=""; DG_TREE_OPEN.clear();');
    await run('loadAdminTree()');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('dg-pend'), '🔴 rozeti yok');
    assert.ok((h.match(/🔴 1/g) || []).length >= 2, 'park ve proje seviyesinde rozet: ' + (h.match(/🔴 \d/g) || []).join(','));
    const sum = el('adminPending').innerHTML;
    assert.ok(sum.includes('1 kayıt onay bekliyor'), sum.slice(0, 160));
    assert.ok(sum.includes('🌳 1 park') && sum.includes('👤 1 kullanıcı'), sum.slice(0, 200));
    assert.equal(el('adminPendingBadge').textContent, '1', 'yan menü rozeti');
    assert.equal(el('adminPendingBadge').style.display, 'inline-block');
  });

  test('"🔴 Bekleyenler" kısayolu yalnız bekleyeni gösterir', async () => {
    run('dgTreeOnlyPending()');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('Göksu Parkı - kuzey'), 'bekleyen kaydı olan proje görünmeli');
    assert.ok(!h.includes('Göksu Parkı - deneme'), 'onaylı proje gizlenmeli');
    assert.equal(el('treeStatus').value, 'Beklemede', 'filtre kutusu da senkron olmalı');
    run('dgTreeSetStatus("")');
  });

  test('"Bekleyenleri aç" yalnız ilgili düğümleri açar', async () => {
    run('DG_TREE_OPEN.clear(); dgTreeOpenPending();');
    const open = run('Array.from(DG_TREE_OPEN)');
    assert.ok(open.some((k) => k.startsWith('p')), 'park düğümü açıldı');
    assert.ok(open.some((k) => k.startsWith('j')), 'proje düğümü açıldı');
    assert.ok(open.some((k) => k.startsWith('u')), 'kullanıcı düğümü açıldı');
    assert.ok(el('adminTree').innerHTML.includes('approveMeas(2)'), 'bekleyen satırın onay düğmesi görünür oldu');
  });

  test('⭐ sorgu JS istisnası fırlatırsa "yükleniyor"da ASILI KALMAZ', async () => {
    W.route(() => { throw new Error('ağ koptu'); });
    run('DG_TREE_ERR=null; DG_TREE_ROWS=[];');
    await run('loadAdminTree()');
    const h = el('adminTree').innerHTML;
    assert.ok(!h.includes('Ölçümler yükleniyor'), 'kutuda hâlâ yükleniyor yazıyor → asılı kaldı');
    assert.ok(h.includes('beklenmedik sorgu hatası') && h.includes('ağ koptu'), h.slice(0, 220));
    assert.ok(h.includes('loadAdminTree()'), 'yeniden dene düğmesi olmalı');
  });

  test('bekleyen yoksa özet kutusu ve rozet gizlenir', async () => {
    W.route((st) => st.table === 'measurements' ? { data: TREEROWS.filter((r) => r.status === 'Onaylı'), count: 1, error: null } : { data: [], error: null });
    run('DG_TREE_STATUS="";');
    await run('loadAdminTree()');
    assert.equal(el('adminPending').style.display, 'none');
    assert.equal(el('adminPendingBadge').style.display, 'none');
    assert.ok(!el('adminTree').innerHTML.includes('dg-pend'), 'rozet basılmamalı');
  });

  test('yan menü rozeti sekme açılmadan da tazeleniyor (hafif count sorgusu)', async () => {
    W.route((st) => (st.table === 'measurements' && st.limit === undefined ? { data: null, count: 7, error: null } : { data: [], error: null }));
    el('adminPendingBadge').textContent = '';
    await run('dgRefreshPendingBadge()');
    assert.equal(el('adminPendingBadge').textContent, '7');
  });

  test('embed patlarsa yedek JOIN modu devreye girer', async () => {
    W.route((st) => {
      /* Gömülü sorgu FK adıyla tanınır: profiles!measurements_owner_fkey(...) */
      if (st.table === 'measurements' && String(st.select).includes('profiles!')) return { data: null, error: { message: 'embed bozuk' } };
      if (st.table === 'measurements') return { data: TREEROWS.map((r) => ({ ...r, profiles: undefined, projects: undefined })) , error: null };
      if (st.table === 'projects') return { data: [{ id: 10, name: 'Göksu Parkı - deneme', park_id: 7, park_name: 'Göksu Parkı', parks: { id: 7, name: 'Göksu Parkı', area_m2: 508000, city: 'Ankara' } }, { id: 11, name: 'Göksu Parkı - kuzey', park_id: 7, parks: { id: 7, name: 'Göksu Parkı', area_m2: 508000, city: 'Ankara' } }, { id: 12, name: 'Ülkü', park_id: null, parks: null }], error: null };
      if (st.table === 'profiles') return { data: [{ id: 'u1', full_name: 'Ayşe Yılmaz' }, { id: 'u2', full_name: 'Burak Demir' }, { id: 'u3', full_name: 'Cem Kaya' }], error: null };
      return { data: [], error: null };
    });
    run('DG_TREE_ERR=null;');
    await run('loadAdminTree()');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('Göksu Parkı') && h.includes('Ayşe Yılmaz'), 'yedek join ağacı kuramadı: ' + h.slice(0, 200));
    assert.ok(!h.includes('Ölçümler okunamadı'), 'yedek çalışırken hata kutusu gösterilmemeli');
  });
});

/* Sahte Supabase'in API biçimine sadık kaldığını doğrula: bu olmadan sıkılaştırma
 * sessizce gevşeyebilir ve `from().order()` gibi geçersiz zincirler yine kaçardı. */
describe('sahte Supabase, supabase-js sözleşmesini taklit ediyor', () => {
  test('from() yalnız select/insert/update/delete/upsert verir', () => {
    assert.equal(run('typeof sb.from("measurements").order'), 'undefined');
    assert.equal(run('typeof sb.from("measurements").limit'), 'undefined');
    assert.equal(run('typeof sb.from("measurements").eq'), 'undefined');
    assert.equal(run('typeof sb.from("measurements").select'), 'function');
    assert.equal(run('typeof sb.from("measurements").insert'), 'function');
  });

  test('order/limit/eq ancak select() sonrası var', () => {
    assert.equal(run('typeof sb.from("measurements").select("*").order'), 'function');
    assert.equal(run('typeof sb.from("measurements").select("*").limit'), 'function');
    assert.equal(run('typeof sb.from("measurements").select("*").eq'), 'function');
    assert.equal(run('typeof sb.from("measurements").select("*").single'), 'function');
  });

  test('geçersiz zincir gerçekten TypeError verir (canlıdaki hata)', () => {
    let hata = null;
    try { run('sb.from("measurements").order("created_at")'); } catch (e) { hata = e.message; }
    assert.ok(hata && /not a function|is not defined/i.test(hata), 'sahte fazla gevşek: ' + hata);
  });
});

/* =========================================================
   9) PARK KİMLİKLERİ — CANLIDAKİ ÇİFT KİMLİK SENARYOSU
   (2026-09-24: aynı Göksu Parkı #1 elle + #2 OSM olarak kayıtlıydı)
========================================================= */
describe('park kimlikleri: çift kimlik birleştirme + yeniden adlandırma', () => {
  const LIVE = [
    { id: 1, name: 'Göksu Parkı', name_norm: 'goksu parki', osm_key: 'manual/goksu parki/39.972/32.659', osm_type: 'manual', source: 'manual', area_m2: 508000, city: 'Ankara', country: 'Türkiye', centroid_lat: 39.972, centroid_lon: 32.659 },
    { id: 2, name: 'Göksu Parkı', name_norm: 'goksu parki', osm_key: 'way/423602737', osm_type: 'way', osm_id: 423602737, source: 'osm', area_m2: 501437, city: 'Ankara', country: 'Türkiye', centroid_lat: 39.9755, centroid_lon: 32.6551 },
    { id: 7, name: 'İsimsiz Park', name_norm: 'isimsiz park', osm_key: 'relation/19482454', osm_type: 'relation', source: 'backfill', area_m2: 1840, city: 'Afyonkarahisar', country: 'Türkiye', centroid_lat: 38.75, centroid_lon: 30.54 },
  ];

  before(() => {
    W.route((st) => {
      if (st.table === 'parks') {
        if (st.op === 'delete') return { data: null, error: null };
        if (st.op === 'update') return { data: [{ id: (st.filters[0] || {}).v, ...st.patch }], error: null };
        const idf = st.filters.find((f) => f.k === 'id');
        return { data: idf ? LIVE.filter((p) => p.id === idf.v) : LIVE, error: null };
      }
      if (st.table === 'projects') return { data: [
        { id: 10, name: 'Göksu Parkı - deneme', park_id: 1 },
        { id: 11, name: 'Göksu Parkı - kuzey', park_id: 2 },
        { id: 12, name: 'Afyon Çocuk parkı', park_id: 7 },
      ], error: null };
      if (st.table === 'measurements') return { data: [{ park_id: 1 }, { park_id: 1 }, { park_id: 2 }, { park_id: 7 }], error: null };
      return { data: [], error: null };
    });
  });

  test('⭐ çift kimlik otomatik bulunuyor: ad + mesafe + tek tık öneri', async () => {
    await run('loadParkAdmin()');
    const h = el('parkAdminBox').innerHTML;
    assert.ok(h.includes('çift kimlik adayı'), 'uyarı yok');
    assert.ok(h.includes('aradaki mesafe'), 'mesafe gösterilmeli (karar için ölçü)');
    /* OSM kimliği hedef olmalı (canonical), elle oluşturulan kaynak */
    assert.ok(h.includes('dgParkMergeInto(1,2)'), 'öneri: #1 → #2 (OSM). İçerik: ' + (h.match(/dgParkMergeInto\([^)]*\)/g) || []).join(','));
    assert.ok(h.includes('#1') && h.includes('#2'), 'iki kimlik de listelenmeli');
  });

  test('adı olmayan park işaretleniyor (İsimsiz Park)', async () => {
    const h = el('parkAdminBox').innerHTML;
    assert.ok(h.includes('parkın adı yok'), 'adsız park uyarısı yok');
    assert.ok(h.includes('#7'), 'adsız park id’si gösterilmeli');
  });

  test('tabloda proje/kayıt sayıları ve kaynak görünüyor', async () => {
    const h = el('parkAdminBox').innerHTML;
    assert.ok(h.includes('manual') && h.includes('backfill'), 'kaynak sütunu');
    assert.ok(h.includes('50.8 ha') && h.includes('50.1 ha'), 'alanlar');
  });

  test('⭐ birleştirme: projeler + ölçümler taşınır, adlar kurulur, kaynak silinir', async () => {
    W.reset();
    await run('dgParkMergeInto(1,2)');
    const pj = LOG.filter((l) => l.table === 'projects' && l.op === 'update');
    assert.ok(pj.some((l) => l.patch.park_id === 2 && l.filters.some((f) => f.k === 'park_id' && f.v === 1)), 'projeler taşınmadı');
    const mm = LOG.filter((l) => l.table === 'measurements' && l.op === 'update');
    assert.ok(mm.some((l) => l.patch.park_id === 2), 'ölçümler taşınmadı');
    assert.ok(pj.some((l) => l.patch.park_name === 'Göksu Parkı'), 'proje adları hedef park adıyla yeniden kurulmalı');
    assert.ok(LOG.some((l) => l.table === 'parks' && l.op === 'delete' && l.filters.some((f) => f.k === 'id' && f.v === 1)), 'kaynak kimlik silinmeli');
  });

  test('geçersiz birleştirme reddedilir (kendi içine / hedef yok)', async () => {
    W.reset();
    await run('dgParkMergeInto(1,1)');
    await run('dgParkMergeInto(1,0)');
    assert.ok(!LOG.some((l) => l.op === 'delete'), 'kendi içine birleştirme silme yapmamalı');
  });

  test('⭐ yeniden adlandırma: name + name_norm + proje adları senkron', async () => {
    run('__prompt="Afyon Çocuk Parkı"');
    W.reset();
    await run('dgParkRename(7)');
    const up = LOG.find((l) => l.table === 'parks' && l.op === 'update');
    assert.ok(up, 'park güncellenmedi');
    assert.equal(up.patch.name, 'Afyon Çocuk Parkı');
    assert.equal(up.patch.name_norm, 'afyon cocuk parki', 'eşleştirme anahtarı da güncellenmeli');
    assert.ok(LOG.some((l) => l.table === 'projects' && l.op === 'update' && l.patch.park_name === 'Afyon Çocuk Parkı'),
      'proje adları yeni park adıyla yeniden kurulmalı');
    run('__prompt=undefined');
  });

  test('prompt iptal edilirse hiçbir şey yazılmaz', async () => {
    run('__prompt=null');
    W.reset();
    await run('dgParkRename(7)');
    assert.ok(!LOG.some((l) => l.op === 'update' || l.op === 'delete'), 'iptal = yazma yok');
    run('__prompt=undefined');
  });

  test('⚠ yeni çift kimlik üretme: 50 ha parkta 700 m uzaktaki ad eşleşir', async () => {
    /* Canlıdaki hatanın tekrarı: elle #1 (39.972,32.659) varken OSM way/423602737
     * (~390 m uzakta) algılansa → TEK kimlikte birleşmeli, yeni satır açmamalı. */
    run('DG_PARK_SESSION.clear(); DG_PARK_SCHEMA_OK=true;');
    W.reset();
    const got = await run('dgRegisterPark({name:"Göksu Parkı",type:"way",id:423602737,area:501437},{lat:39.9755,lon:32.6551})');
    assert.equal(got.id, 1, 'mevcut kimliğe bağlanmalıydı, yeni satır açıldı: ' + JSON.stringify(got));
    assert.ok(!LOG.some((l) => l.table === 'parks' && l.op === 'insert'), 'yeni park satırı açılmamalı');
  });
});

/* =========================================================
   10) PARKA BAĞLAMA YALNIZ YÖNETİCİ (kullanıcı isteği 2026-09-24)
========================================================= */
describe('parka bağlama yalnız yönetici — normal kullanıcı kilitli', () => {
  const PENDING_ROWS = [
    { park_id: 7, park_name: 'Göksu Parkı', city: 'Ankara', records: 3, projects: 1, contributors: 1, carbon_kg: 380, avg_dbh: 20, avg_height: 7, species_n: 1, area_m2: 508000, park_pending: false },
    { park_id: 0, park_name: 'Göksu Parkı - Göksu', city: 'Ankara', records: 1, projects: 1, contributors: 1, carbon_kg: 380, avg_dbh: 65, avg_height: 8, species_n: 1, area_m2: null, park_pending: true },
  ];

  test('normal kullanıcı: kapı "yeni proje" yolunu gösterir, bağlama düğmesi YOK', () => {
    run('PROFILE={id:"u-9",role:"user",full_name:"Normal Kullanıcı"};');
    run(`PROJ_LIST=[{id:2,name:"Ülkü",park_id:null,parks:null}];`);
    el('mProject').innerHTML = '<option value="2">Ülkü</option>';
    el('mProject').value = '2';
    run('dgParkGate()');
    const h = el('parkGate').innerHTML;
    assert.equal(el('parkGate').className, 'alert err');
    assert.equal(el('saveBtn').disabled, true, 'ölçüm yine kilitli olmalı');
    assert.ok(h.includes('yalnız yöneticide'), h.slice(0, 200));
    assert.ok(h.includes('Park Algıla → Yeni Proje Oluştur'), 'yeni proje yolu gösterilmeli');
    assert.ok(!h.includes('Parkı Algıla ve Bağla'), 'bağlama düğmesi gizlenmeli');
    assert.ok(!h.includes('projectId:2'), 'normal kullanıcı bağlamaya yönlendirilmemeli');
  });

  test('⭐ dgLinkProject normal kullanıcıda HİÇBİR ŞEY yazmaz', async () => {
    run('DG_PARK={id:7,name:"Göksu Parkı",osm_key:"way/1",area_m2:508000};');
    el('scanLabel').value = 'deneme';
    W.reset();
    W.route(() => ({ data: [], error: null }));
    const out = await run('dgLinkProject(2)');
    assert.equal(out, null);
    assert.ok(!LOG.some((l) => l.table === 'projects' && l.op === 'update'), 'proje güncellenmemeliydi');
    assert.ok(TOASTS.some((t) => t[0].includes('yalnız yöneticide')), JSON.stringify(TOASTS));
  });

  test('park kimliği araçları (adlandır/birleştir/sil) normal kullanıcıda yazmaz', async () => {
    run('DG_PARK_ADMIN_ROWS=[{id:1,name:"a",osm_key:"manual/a",area_m2:1000},{id:2,name:"a",osm_key:"way/2",area_m2:1000}];');
    run('__prompt="Yeni Ad"');
    W.reset();
    W.route(() => ({ data: [], error: null }));
    await run('dgParkRename(1)');
    await run('dgParkMergeInto(1,2)');
    await run('dgParkDelete(1)');
    assert.ok(!LOG.some((l) => l.op === 'update' || l.op === 'delete'), 'hiçbir yazma olmamalı: ' + JSON.stringify(LOG.map((l) => l.table + ':' + l.op)));
    assert.ok(TOASTS.filter((t) => t[0].includes('yalnız yöneticiye açık')).length >= 3, JSON.stringify(TOASTS));
    run('__prompt=undefined');
  });

  test('⭐ karşılaştırmada onarım düğmesi normal kullanıcıya görünmüyor', async () => {
    W.route((st) => st.table === 'v_park_compare' ? { data: PENDING_ROWS, error: null } : { data: [], error: null });
    await run('loadParkCompare()');
    const h = el('parkCompare').innerHTML;
    assert.ok(h.includes('PARK ALGILANMAMIŞ KAYITLAR'), 'bölüm durmalı (veri gizlenmez)');
    assert.ok(h.includes('Göksu Parkı - Göksu'), 'kayıt listelenmeli');
    assert.ok(!h.includes("startParkScan({returnTo:'world'})"), '🌳 Park Algıla düğmesi gizlenmeli');
    assert.ok(h.includes('🔐 yönetici bağlayacak'), 'yerine açıklama gösterilmeli');
    assert.ok(h.includes('yalnız yönetici'), 'kim yapacak söylenmeli');
  });

  test('projeler tablosunda 🌳 Bağla yerine "yönetici bağlayacak"', async () => {
    W.route((st) => st.table === 'projects'
      ? { data: [{ id: 2, name: 'Ülkü', park_id: null, created_at: '2026-08-01', parks: null }], error: null }
      : { data: [], error: null });
    run('USER={id:"u-9"};');
    await run('loadProjects()');
    const h = el('projTable').innerHTML;
    assert.ok(h.includes('⛔ park yok'), 'durum görünmeli');
    assert.ok(!h.includes('startParkScan({projectId:2'), 'bağlama düğmesi gizlenmeli');
    assert.ok(h.includes('🔐 yönetici bağlayacak'), h.slice(0, 200));
  });

  test('yönetici aynı yerlerde düğmeleri GÖRÜR (kural tersine dönmez)', async () => {
    run('PROFILE={id:"u-1",role:"owner",full_name:"Kurucu"}; USER={id:"u-1"};');
    W.route((st) => {
      if (st.table === 'v_park_compare') return { data: PENDING_ROWS, error: null };
      if (st.table === 'projects') return { data: [{ id: 2, name: 'Ülkü', park_id: null, created_at: '2026-08-01', parks: null }], error: null };
      return { data: [], error: null };
    });
    await run('loadProjects()');
    assert.ok(el('projTable').innerHTML.includes('startParkScan({projectId:2'), 'yönetici bağlayabilmeli');
    el('mProject').value = '2';
    run('dgParkGate()');
    assert.ok(el('parkGate').innerHTML.includes('Parkı Algıla ve Bağla'), 'yönetici kapıda bağlama görür');
    await run('loadParkCompare()');
    assert.ok(el('parkCompare').innerHTML.includes("startParkScan({returnTo:'world'})"), 'yönetici onarım düğmesini görür');
    assert.ok(!el('parkCompare').innerHTML.includes('🔐 yönetici bağlayacak'), 'yöneticiye "yönetici bağlayacak" denmez');
  });

  test('normal kullanıcı YENİ proje açabilir (saha akışı kilitlenmedi)', async () => {
    run('PROFILE={id:"u-9",role:"user",full_name:"Normal"};');
    run('DG_PARK={id:7,name:"Göksu Parkı",osm_key:"way/1",area_m2:508000};');
    el('pLabel').value = 'deneme'; el('pCountry').value = ''; el('pCity').value = '';
    W.reset();
    W.route((st) => st.table === 'projects' && st.op === 'insert' ? { data: { id: 33, ...st.rows }, error: null } : { data: [], error: null });
    await run('createProject()');
    const ins = lastInsert('projects');
    assert.ok(ins, 'yeni proje oluşturulabilmeli');
    assert.equal(ins.rows.name, 'Göksu Parkı - deneme');
    assert.equal(ins.rows.park_id, 7);
  });
});

/* =========================================================
   11) GOOGLE İLE GİRİŞ (OAuth)
========================================================= */
describe('Google ile giriş', () => {
  const { AUTH } = W;

  test('⭐ düğme signInWithOAuth(provider:google) çağırıyor', async () => {
    AUTH.oauth.length = 0; AUTH.oauthError = null;
    await run('dgGoogleSignIn()');
    assert.equal(AUTH.oauth.length, 1, 'OAuth çağrılmadı');
    assert.equal(AUTH.oauth[0].provider, 'google');
    assert.equal(AUTH.oauth[0].options.redirectTo, 'https://dendrogeo.org/', 'redirectTo origin+pathname olmalı');
    assert.equal(AUTH.oauth[0].options.queryParams.prompt, 'select_account', 'sahada ortak tablet → hesap seçimi');
  });

  test('yönlendirme sırasında bekleme şeridi + düğme kilidi', async () => {
    assert.equal(el('oauthWait').style.display, 'block');
    assert.equal(el('googleBtn').disabled, true);
  });

  test('sağlayıcı kapalıysa anlaşılır mesaj (çökme yok)', async () => {
    AUTH.oauth.length = 0;
    AUTH.oauthError = { message: 'Provider google is not enabled' };
    run('amsg=(t,e)=>{ __toasts.push([String(t),e?"err":"ok",""]); };');
    await run('dgGoogleSignIn()');
    const msg = TOASTS.map((t) => t[0]).join(' ');
    assert.ok(msg.includes('henüz etkin değil'), msg.slice(0, 200));
    assert.ok(msg.includes('docs/google-giris.md'), 'kurulum rehberine yönlendirmeli');
    assert.equal(el('googleBtn').disabled, false, 'düğme tekrar kullanılabilir olmalı');
    assert.equal(el('oauthWait').style.display, 'none');
    AUTH.oauthError = null;
  });

  test('⭐ geri dönüş algılanıyor: ?code= (PKCE) ve #access_token (implicit)', () => {
    W.ctx.location.search = ''; W.ctx.location.hash = '';
    assert.equal(run('dgIsOAuthCallback()'), false);
    W.ctx.location.search = '?code=0a1b2c';
    assert.equal(run('dgIsOAuthCallback()'), true);
    W.ctx.location.search = ''; W.ctx.location.hash = '#access_token=xyz';
    assert.equal(run('dgIsOAuthCallback()'), true);
    W.ctx.location.search = '?error=access_denied'; W.ctx.location.hash = '';
    assert.equal(run('dgIsOAuthCallback()'), true);
    assert.equal(run('dgOAuthError()'), 'access_denied');
    W.ctx.location.search = '';
  });

  test('⭐ takas bitince oturum döner (SIGNED_IN)', async () => {
    AUTH.listeners.length = 0;
    const p = run('dgWaitForOAuthSession(5000)');
    AUTH.listeners.forEach((cb) => cb('SIGNED_IN', { access_token: 'tok', user: { id: 'g1' } }));
    const s = await p;
    assert.ok(s && s.access_token === 'tok', 'oturum dönmedi');
  });

  test('takas boş dönerse null → landing + uyarı (sonsuz bekleme yok)', async () => {
    AUTH.listeners.length = 0;
    const p = run('dgWaitForOAuthSession(5000)');
    AUTH.listeners.forEach((cb) => cb('INITIAL_SESSION', null));
    W.flush();                     // INITIAL_SESSION sonrası tanınan ek süre
    const s = await p;
    assert.equal(s, null);
  });

  test('zaten oturum varsa dinleyiciyi beklemeden çözülür (yarış koruması)', async () => {
    AUTH.listeners.length = 0;
    AUTH.session = { access_token: 'onceki', user: { id: 'u1' } };
    const s = await run('dgWaitForOAuthSession(5000)');
    assert.ok(s && s.access_token === 'onceki');
    AUTH.session = null;
  });

  test('boot() OAuth dönüşünde takası BEKLİYOR (landing\'e erken düşmesin)', () => {
    const shell = readFileSync(join(ROOT, 'src/ui/shell.js'), 'utf8');
    assert.match(shell, /dgIsOAuthCallback\(\)/);
    assert.match(shell, /session=await dgWaitForOAuthSession\(\)/);
    assert.match(shell, /dgCleanOAuthUrl\(\)/, '?code= kalıntısı temizlenmeli');
    assert.match(shell, /Google girişi tamamlanamadı/, 'başarısızlıkta kullanıcıya haber verilmeli');
  });
});

/* =========================================================
   12) FOTOĞRAF ÖNİZLEMESİ (kullanıcı: "fotoğraflar küçük gözüksün")
========================================================= */
describe('fotoğraf önizlemesi listelerde küçük görsel olarak çıkıyor', () => {
  const PH = 'https://xjbpounwdxrhelmixvqm.supabase.co/storage/v1/object/public/dendro-photos/u1/1.jpg';

  test('⭐ ağaç satırında 40×40 kapak görseli + lazy yükleme', async () => {
    /* Önceki bölüm PROFILE'ı "user" rolünde bırakmıştı; loadAdminTree yönetici
     * değilse erken döner. Testler kendi ön koşulunu kurmalı (sıra bağımsızlığı). */
    run('PROFILE={id:"u-1",role:"owner",full_name:"Kurucu"}; USER={id:"u-1"};');
    W.route((st) => st.table === 'measurements' ? { data: [
      { id: 5, owner: 'u1', project_id: 10, park_id: 5, carbon_kg: 120, status: 'Beklemede', species: 'KARAÇAM', grp: 'İBRELİ', point_id: 3, measurement_no: 1, dbh_cm: 37, height_m: 2, created_at: '2026-09-20T10:00:00Z', photo_url: PH,
        profiles: { full_name: 'Sinan Şirin' },
        projects: { id: 10, name: 'Atatürk Çocukları - deneme', park_id: 5, parks: { id: 5, name: 'Atatürk Çocukları ve Doğal Yaşam Parkı', area_m2: 852000, city: 'Ankara' } } },
    ], count: 1, error: null } : { data: [], error: null });
    run('DG_TREE_STATUS=""; DG_TREE_QUERY=""; DG_TREE_OPEN.clear(); DG_TREE_OPEN.add("p5"); DG_TREE_OPEN.add("j10");');
    await run('loadAdminTree()');
    const h = el('adminTree').innerHTML;
    assert.ok(h.includes('<img class="dg-thumb"'), 'kapak görseli yok: ' + h.slice(0, 200));
    assert.ok(h.includes('loading="lazy"'), 'uzun listede lazy şart');
    assert.ok(h.includes('src="' + PH + '"'), 'foto adresi basılmadı');
    assert.ok(h.includes('target="_blank"') && h.includes('rel="noopener"'), 'yeni sekmede açılmalı');
    assert.ok(!/>📷</.test(h), 'eski emoji-only gösterim kalmamalı');
  });

  test('fotoğrafı olmayan satırda "—" (bozuk görsel yok)', () => {
    run('DG_TREE_ROWS=[{id:6,owner:"u1",project_id:10,park_id:5,carbon_kg:10,status:"Onaylı",species:"HUŞ",grp:"YAPRAKLI",point_id:4,measurement_no:1,photo_url:null,profiles:{full_name:"A"},projects:{id:10,name:"x",park_id:5,parks:{id:5,name:"Göksu Parkı"}}}]');
    run('dgTreeDraw()');
    const h = el('adminTree').innerHTML;
    assert.ok(!h.includes('<img'), 'görsel basılmamalı');
    assert.ok(h.includes('—'), 'tire gösterilmeli');
  });

  test('XSS: foto adresi escape ediliyor', () => {
    run('DG_TREE_ROWS=[{id:7,owner:"u1",project_id:10,park_id:5,carbon_kg:10,status:"Onaylı",species:"HUŞ",grp:"YAPRAKLI",point_id:5,measurement_no:1,photo_url:\'x" onerror="alert(1)\',profiles:{full_name:"A"},projects:{id:10,name:"x",park_id:5,parks:{id:5,name:"Göksu Parkı"}}}]');
    run('dgTreeDraw()');
    const h = el('adminTree').innerHTML;
    assert.ok(!h.includes('onerror="alert(1)"'), 'ham onerror sızmamalı: ' + h.slice(h.indexOf('dg-thumb') - 40, h.indexOf('dg-thumb') + 160));
    assert.ok(h.includes('&quot;'), 'tırnak escape edilmeli');
  });

  test('düz liste ve Kayıtlarım da aynı yardımcıyı kullanıyor', () => {
    const adm = readFileSync(join(ROOT, 'src/services/admin.js'), 'utf8');
    const dash = readFileSync(join(ROOT, 'src/services/dash.js'), 'utf8');
    const consts = readFileSync(join(ROOT, 'src/config/constants.js'), 'utf8');
    assert.match(consts, /const dgThumb=\(url,px\)=>\{/);
    assert.match(consts, /loading="lazy"/);
    assert.match(adm, /dgThumb\(x\.photo_url\)/);
    assert.match(dash, /dgThumb\(r\.photo_url\)/);
    assert.ok(!/width:40px;height:40px;object-fit:cover/.test(adm), 'satır içi stil kalıntısı');
  });

  test('CSS: 40×40 kapak, hover büyüme, mobilde 44px', () => {
    const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
    assert.match(css, /\.dg-thumb\{width:40px;height:40px;object-fit:cover/);
    assert.match(css, /a:hover \.dg-thumb[^{]*\{transform:scale\(1\.08\)/);
    assert.match(css, /@media\(max-width:640px\)\{\s*\.dg-thumb\{width:44px;height:44px\}/);
  });
});

/* =========================================================
   13) KVKK AÇIK RIZA (kayıt kapısı)
========================================================= */
describe('kayıt formunda KVKK açık rızası zorunlu', () => {
  const { AUTH } = W;

  test('⭐ rıza kutusu işaretli değilse hesap AÇILMIYOR', async () => {
    AUTH.signups.length = 0;
    el('rgName').value = 'Ayşe Yılmaz';
    el('rgEmail').value = 'ayse@example.com';
    el('rgPass').value = 'parola123';
    el('rgOrg').value = 'Üniversite';
    el('rgConsent').checked = false;
    run('tsToken=(id)=>"sahte-jeton";');
    W.reset();
    await run('doRegister()');
    assert.equal(AUTH.signups.length, 0, 'rıza olmadan signUp çağrılmamalıydı');
    assert.ok(TOASTS.some((t) => /onay kutusunu işaretleyin/i.test(t[0])), JSON.stringify(TOASTS));
  });

  test('⭐ rıza verilince kayıt gidiyor + zaman damgalı rıza kaydı yazılıyor', async () => {
    AUTH.signups.length = 0;
    el('rgConsent').checked = true;
    W.reset();
    W.route((st) => st.table === 'profiles' ? { data: [{ id: 'yeni', role: 'user', active: true }], error: null } : { data: [], error: null });
    await run('doRegister()');
    assert.equal(AUTH.signups.length, 1, 'kayıt gitmedi');
    const d = AUTH.signups[0].options.data;
    assert.equal(d.kvkk_consent, true);
    assert.match(d.kvkk_consent_at, /^\d{4}-\d{2}-\d{2}T/, 'zaman damgası ISO olmalı');
    assert.equal(d.kvkk_consent_version, '1.0');
    assert.equal(d.full_name, 'Ayşe Yılmaz');
  });

  test('rıza metni aydınlatma + gizlilik sayfalarına bağlı', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    /* Bağlantılar <label> içinde, input'tan SONRA gelir → id'nin sonrasını kes. */
    const i = html.indexOf('id="rgConsent"');
    const seg = html.slice(i, i + 1400);
    assert.match(seg, /\/aydinlatma\//);
    assert.match(seg, /\/gizlilik\//);
    assert.match(seg, /konum verimin/, 'konum verisi açıkça sayılmalı');
  });
});
