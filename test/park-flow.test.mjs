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

  function qb(table, st) {
    const self = {
      select(c) { st.select = c; return self; },
      eq(k, v) { st.filters.push({ op: 'eq', k, v }); return self; },
      neq(k, v) { st.filters.push({ op: 'neq', k, v }); return self; },
      gte(k, v) { st.filters.push({ op: 'gte', k, v }); return self; },
      lte(k, v) { st.filters.push({ op: 'lte', k, v }); return self; },
      is(k, v) { st.filters.push({ op: 'is', k, v }); return self; },
      order(k, o) { st.order = [k, o]; return self; },
      limit(n) { st.limit = n; return self; },
      range(a, b) { st.range = [a, b]; return self; },
      single() { st.single = true; return self; },
      maybeSingle() { st.single = true; return self; },
      insert(rows) { st.op = 'insert'; st.rows = rows; return self; },
      update(patch) { st.op = 'update'; st.patch = patch; return self; },
      upsert(rows, o) { st.op = 'upsert'; st.rows = rows; st.onConflict = o; return self; },
      delete() { st.op = 'delete'; return self; },
      then(res, rej) {
        st.table = table;
        LOG.push(JSON.parse(JSON.stringify({ ...st })));
        Promise.resolve().then(() => ROUTER(st)).then(res, rej);
      },
    };
    return self;
  }

  const sbStub = {
    from: (t) => qb(t, { filters: [], op: 'select' }),
    storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }), remove: async () => ({}) }) },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  };

  /* ---------- sahte DOM ---------- */
  const els = new Map();
  const mkEl = (id) => ({
    id, innerHTML: '', textContent: '', value: '', className: '', disabled: false,
    style: {}, dataset: {}, checked: false, files: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    scrollIntoView() {}, appendChild() {}, remove() {}, setAttribute() {},
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
    location: { hash: '' },
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
    alert: () => {}, confirm: () => true,
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
  const scripts = [...html.matchAll(/<script src="(src\/[^"?]+)[^"]*"><\/script>/g)].map((m) => m[1]);
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
    ctx, LOG, TOASTS, GOES,
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
