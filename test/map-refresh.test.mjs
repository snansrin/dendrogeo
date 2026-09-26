/* map-refresh.test.mjs — "ONAYLADIM AMA HARİTADA GÖREMİYORUM" BEKÇİSİ
 *
 * 2026-09-26'da kullanıcı canlıda şunu bildirdi: "son yüklenen veriyi
 * onaylamama rağmen ne dünyada ne canlı haritada göremiyorum."
 * Veritabanı tarafı sağlamdı (kayıt status='Onaylı', shared=true, RLS anon'a
 * açık, REST aynı 12 satırı dönüyor) — sorun istemcideydi. Gerçek Chrome ile
 * canlı sitede ölçülerek üç ayrı kök neden kanıtlandı:
 *
 *  1) ÇİFT İŞARETÇİ: addMarkersChunked küme varsa TEMİZLEMEDEN ekliyordu.
 *     loadWorld() hem startShell'de hem her approveMeas'ta çalıştığı için
 *     küme 12 → 24 → 36 diye şişiyordu (ölçüldü: 2. loadWorld sonrası
 *     rozet "24", aynı nokta kümede 2 kez).
 *
 *  2) CANLI HARİTA BİR KEZ YÜKLENİYORDU: go("map") içindeki
 *     if(!liveLoaded){liveLoaded=true;loadLiveMap();} kapısı yüzünden onaydan
 *     sonra sekmeye dönen yönetici ESKİ kümeyi görüyordu; F5 şarttı.
 *
 *  3) SAHTE BAŞARI: loadApprovedMarkers sorgu error'ünü yok sayıyor, catch de
 *     yutuyordu → done(0,[]) → ekranda YEŞİL "✓ 0 onaylı kayıt yüklendi".
 *     loadWorld()'ün catch(e){}'sı ise her hatayı sessizce gömüyordu.
 *
 *  4) YANLIŞ TEŞHİS: v_park_compare 42501 (permission denied) döndüğünde
 *     dgParkSchemaMissing çağrılıyor, DG_PARK_SCHEMA_OK=false oluyor ve ÖLÇÜM
 *     KAPISI kapanıp yeni kayıtlar park_id=null yazılıyordu (measure.js:278/318).
 *     Yani geçici bir yetki hatası kalıcı veri bütünlüğü kaybına dönüşüyordu.
 *
 * Bu dosya dördünün de GERİ GELMEMESİNİ kilitler.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const idx = read('index.html');

/* ---------- map.js'i tek başına çalıştıran mini bağlam ----------
 * map.js DOM'a yalnız $("mapLoad") üzerinden dokunur; L ve sb sahte.
 * test-harness'ın SIRALAMA listesinde map.js yok (DOM'a yapışan modüller
 * bilinçli dışarıda), o yüzden burada aynı yaklaşımla ayrı bir bağlam kurulur. */
function loadMapModule({ queryError = null, rows = null, noClusterPlugin = false } = {}) {
  /* clusterChildren = kümedeki işaretçi sayısı (getChildCount bunu döndürür).
   * L.marker AYRI sayılır: gerçek kodda marker önce kurulur, sonra
   * cluster.addLayer(mk) ile kümeye girer — ikisini aynı diziye basmak
   * testi kendisi şişiriyordu (12 beklerken 24 ölçtük). */
  const clusterChildren = [];
  const markersMade = [];
  const clusterCalls = { clear: 0, add: 0, create: 0 };
  const fakeCluster = {
    addLayer(mk) { clusterCalls.add++; clusterChildren.push(mk); },
    clearLayers() { clusterCalls.clear++; clusterChildren.length = 0; },
    getChildCount: () => clusterChildren.length,
    eachLayer(fn) { clusterChildren.forEach(fn); },
  };
  const els = {
    mapLoad: { textContent: '', innerHTML: '', className: '', style: {} },
    liveAnalysis: { innerHTML: '' },
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn) => fn(),            /* chunk'ları senkron çalıştır */
    clearTimeout() {},
    Number, Math, JSON, Object, Array, String, Boolean, Promise, Error, isNaN, Date,
    L: {
      ...(noClusterPlugin ? {} : { markerClusterGroup() { clusterCalls.create++; return fakeCluster; } }),
      divIcon: (o) => ({ ...o, _divIcon: true }),
      marker(latlng, o) { const mk = { bindPopup() {}, getLatLng: () => latlng, _latlng: latlng, ...o }; markersMade.push(mk); return mk; },
      layerGroup() { clusterCalls.create++; return fakeCluster; },
      tileLayer: () => ({ addTo() {} }),
      map: () => ({ setView() { return this; }, addLayer() {}, eachLayer() {} }),
    },
    sb: {
      from() {
        return {
          select() { return this; }, eq() { return this; }, order() { return this; },
          limit() {
            return Promise.resolve({
              data: queryError ? null : (rows ?? []),
              count: queryError ? null : (rows ?? []).length,
              error: queryError,
            });
          },
        };
      },
    },
    $: (id) => els[id] || null,
    esc: (s) => String(s ?? ''),
    dgWarnIfTruncated() {},
    renderAnalysis() {},
    toast() {},
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('src/services/map.js'), ctx, { filename: 'map.js' });
  return { ctx, els, clusterCalls, clusterChildren, markersMade, fakeCluster };
}
const fakeRows = (n, lat0 = 39.9) =>
  Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * 0.001, lon: 32.6 + i * 0.001, point_id: i + 1, species: 'SEDİR', dbh_cm: 30, height_m: 10, carbon_kg: 100, grp: 'İBRELİ', photo_url: null }));

describe('1) addMarkersChunked İDEMPOTENT olmalı (çift işaretçi yok)', () => {
  test('küme varsa clearLayers çağrılır → iki yükleme 2N değil N işaretçi bırakır', () => {
    const { ctx, clusterCalls, fakeCluster } = loadMapModule({ rows: fakeRows(12) });
    const m = { _cluster: null, addLayer() {} };
    ctx.addMarkersChunked(m, fakeRows(12));
    assert.equal(clusterCalls.create, 1, 'ilk yükleme kümeyi kurmalı');
    assert.equal(clusterCalls.clear, 0, 'ilk yüklemede temizlik gerekmez');
    assert.equal(fakeCluster.getChildCount(), 12, 'ilk yükleme 12 işaretçi bırakmalı');

    ctx.addMarkersChunked(m, fakeRows(12));
    assert.equal(clusterCalls.create, 1, 'ikinci yükleme YENİ küme kurmamalı');
    assert.equal(clusterCalls.clear, 1, '⭐ ikinci yükleme kümeyi TEMİZLEMELİ (canlıda 24 oluyordu)');
    assert.equal(fakeCluster.getChildCount(), 12, '⭐ iki yükleme sonrası 24 değil 12 kalmalı');

    ctx.addMarkersChunked(m, fakeRows(12));
    assert.equal(fakeCluster.getChildCount(), 12, 'üçüncü yükleme de 12 bırakmalı');
  });

  test('çakışan yüklemelerde bayat tur token ile iptal edilir', () => {
    const { ctx } = loadMapModule();
    /* setTimeout ertelenmiş olsun: iki tur iç içe geçsin */
    const queue = [];
    ctx.setTimeout = (fn) => { queue.push(fn); return queue.length; };
    const m = { _cluster: null, addLayer() {} };
    ctx.addMarkersChunked(m, fakeRows(400), 100);   /* tur A: ilk chunk senkron, 3 chunk kuyrukta */
    ctx.addMarkersChunked(m, fakeRows(400), 100);   /* tur B: A'nın token'ını geçersiz kılar */
    assert.equal(m._markerToken, 2, 'her yükleme token artırmalı');
    const afterTwo = m._cluster.getChildCount();
    let guard = 0;
    while (queue.length && guard++ < 100) { const f = queue.shift(); if (f) f(); }
    /* Tur A'nın kalan chunk'ları eklenmemeli: toplam B'nin 400'ü olmalı,
     * token iptali olmasaydı 700'e çıkardı. */
    assert.equal(m._cluster.getChildCount(), 400,
      'bayat tur iptal edilmeli (beklenen 400, token olmasa 700 olurdu; iki tur hemen sonrası: ' + afterTwo + ')');
  });
});

describe('2) loadApprovedMarkers hatayı YUTMAMALI (sahte yeşil yok)', () => {
  test('sorgu error dönerse done(-1, [], mesaj) — eskiden done(0,[]) ile "✓ 0 kayıt" basıyordu', async () => {
    const { ctx } = loadMapModule({ queryError: { code: '42501', message: 'permission denied for view x' } });
    let seen = null;
    await ctx.loadApprovedMarkers({ addLayer() {} }, 3000, (n, rows, err) => { seen = { n, rows, err }; });
    assert.equal(seen.n, -1, 'başarısızlık -1 ile işaretlenmeli (0 "başarılı ama boş" demekti)');
    assert.match(seen.err, /42501/, 'hata kodu çağıranla iletilmeli');
    assert.match(seen.err, /permission denied/, 'hata metni iletilmeli');
  });

  test('harita null ise sessiz throw değil done(-1,…)', async () => {
    const { ctx } = loadMapModule({ rows: fakeRows(3) });
    let seen = null;
    await ctx.loadApprovedMarkers(null, 3000, (n, rows, err) => { seen = { n, err }; });
    assert.equal(seen.n, -1);
    assert.ok(seen.err, 'sebep iletilmeli');
  });

  test('başarılı yüklemede err null ve n satır sayısı', async () => {
    const { ctx } = loadMapModule({ rows: fakeRows(7) });
    let seen = null;
    await ctx.loadApprovedMarkers({ addLayer() {} }, 3000, (n, rows, err) => { seen = { n, err, len: rows.length }; });
    assert.equal(seen.n, 7); assert.equal(seen.err, null); assert.equal(seen.len, 7);
  });

  test('lat/lon geçersiz satırlar elenir (haritada görünmez nokta olmasın)', async () => {
    const { ctx } = loadMapModule({ rows: [...fakeRows(2), { lat: null, lon: 32, point_id: 99 }, { lat: 39, lon: undefined, point_id: 98 }] });
    let seen = null;
    await ctx.loadApprovedMarkers({ addLayer() {} }, 3000, (n, rows) => { seen = { n, rows }; });
    assert.equal(seen.n, 2);
  });

  test('loadLiveMap hata durumunda KIRMIZI kutu + ↻ çizer, başarı yazdırmaz', async () => {
    const { ctx, els } = loadMapModule({ queryError: { code: 'PGRST205', message: 'could not find the table' } });
    ctx.map = { addLayer() {} };
    await ctx.loadLiveMap();
    assert.match(els.mapLoad.className, /err/, 'hata kırmızı sınıfla gösterilmeli');
    assert.match(els.mapLoad.innerHTML, /yüklenemedi/, 'kullanıcıya başarısızlık söylenmeli');
    assert.match(els.mapLoad.innerHTML, /loadLiveMap\(\)/, '↻ Yeniden dene düğmesi olmalı');
    assert.doesNotMatch(els.mapLoad.textContent + els.mapLoad.innerHTML, /✓ 0 onaylı/, 'sahte başarı metni geri gelmemeli');
  });
});

describe('3) canlı harita onaydan sonra tazelenmeli (liveLoaded kapısı)', () => {
  const shell = read('src/ui/shell.js');
  const mapjs = read('src/services/map.js');
  const admin = read('src/services/admin.js');
  const state = read('src/ui/state.js');
  const off = read('src/services/offline.js');

  test('⭐ go("map") DG_LIVE_DIRTY iken yeniden yükler', () => {
    const line = shell.split('\n').find((l) => l.includes('v==="map"'));
    assert.ok(line, 'go() içindeki map dalı bulunamadı');
    assert.match(line, /DG_LIVE_DIRTY/, 'kapı DG_LIVE_DIRTY\'yi kontrol etmeli');
    assert.match(line, /!liveLoaded\s*\|\|\s*DG_LIVE_DIRTY/, 'ilk açılış VEYA bayat veri → yükle');
    assert.doesNotMatch(line, /liveLoaded\s*=\s*true/, '⭐ eski "bir kez yükle ve kilitle" deseni geri gelmemeli');
  });

  test('DG_LIVE_DIRTY state.js\'te bildiriliyor', () => {
    assert.match(state, /let DG_LIVE_DIRTY=/, 'bayrak global state\'te olmalı');
  });

  test('onay/red/silme canlı haritayı bayat işaretliyor', () => {
    for (const fn of ['approveMeas', 'rejectMeas', 'delMeas']) {
      const i = admin.indexOf('async function ' + fn);
      assert.ok(i > -1, fn + ' bulunamadı');
      const govde = admin.slice(i, admin.indexOf('\nasync function', i + 10) === -1 ? admin.length : admin.indexOf('\nasync function', i + 10));
      assert.match(govde, /dgMarkLiveDirty\(\)/, fn + ' dgMarkLiveDirty() çağırmalı');
    }
  });

  test('çevrimdışı senkronizasyon da haritayı tazeliyor', () => {
    const i = off.indexOf('async function syncOfflineData');
    const govde = off.slice(i, off.indexOf('/* ---- PWA', i));
    assert.match(govde, /dgMarkLiveDirty\(\)/, 'senkron sonrası bayrak düşmeli');
    assert.match(govde, /loadLiveMap\(\)/, 'sekme açıksa doğrudan tazelemeli');
  });

  test('dgMarkLiveDirty / dgMarkLiveLoaded state yoksa patlamaz (try/catch)', () => {
    assert.match(mapjs, /function dgMarkLiveDirty\(\)\{\s*try\{DG_LIVE_DIRTY=true;\}catch/, 'dgMarkLiveDirty korumalı olmalı');
    assert.match(mapjs, /function dgMarkLiveLoaded\(ok\)\{\s*try\{liveLoaded=true;DG_LIVE_DIRTY=false;\}catch/, 'dgMarkLiveLoaded korumalı olmalı');
  });

  test('↻ elle tazeleme düğmesi arayüzde var', () => {
    assert.match(idx, /onclick="loadLiveMap\(\)"/, 'Canlı Harita kartında ↻ düğmesi olmalı');
    assert.match(idx, /İşaretçileri tazele/, 'düğme etiketi bulunamadı');
  });
});

describe('4) loadWorld sessiz başarısızlık içermemeli', () => {
  const dash = read('src/services/dash.js');
  test('⭐ catch(e){} (boş yutma) kaldırıldı', () => {
    const i = dash.indexOf('async function loadWorld');
    assert.ok(i > -1);
    const govde = dash.slice(i, dash.indexOf('function dgWorldError', i));
    assert.doesNotMatch(govde, /catch\(e\)\{\s*\}/, 'boş catch geri gelmemeli');
    assert.match(govde, /dgWorldError\(/, 'hata kullanıcıya gösterilmeli');
  });
  test('işaretçi hatası analiz bloğuna sızdırılmıyor', () => {
    assert.match(dash, /if\(err\)return dgWorldError\(/, 'loadApprovedMarkers hatası kontrol edilmeli');
  });
  test('#worldErr kutusu index.html\'de var', () => {
    assert.match(idx, /id="worldErr"/, 'Dünya sekmesinde hata kutusu olmalı');
  });
  test('landing istatistikleri de sessiz yutulmuyor', () => {
    const land = read('src/ui/landing.js');
    assert.doesNotMatch(land, /catch\(e\)\{\}/, 'initLanding boş catch kullanmamalı');
    assert.match(land, /id="landingMapNote"|landingMapNote/, 'landing harita notu olmalı');
    assert.match(idx, /id="landingMapNote"/, 'landing not kutusu index.html\'de olmalı');
  });
});

describe('5) YETKİ hatası ŞEMA eksiği sanılmamalı (ölçüm kapısı kapanmasın)', () => {
  const ctx = loadApp();
  /* park-registry.js toast() çağırıyor; ui/toast.js harness SIRALAMA'sında yok
   * (DOM'a yapışan UI modülleri bilinçli dışarıda) → testte stub gerekir. */
  ctx.toast = () => {};
  ctx.dgRenderScanCard = () => {};
  test('dgIsSchemaError sınıflandırması doğru', () => {
    const probe = (arg) => vm.runInContext('dgIsSchemaError(' + arg + ')', ctx);
    ctx.__probe = probe;
    /* gerçek şema hataları → true */
    assert.equal(ctx.__probe('{code:"42P01",message:"relation public.parks does not exist"}'), true);
    assert.equal(ctx.__probe('{code:"42703",message:"column park_id does not exist"}'), true);
    assert.equal(ctx.__probe('{message:"could not find the table public.parks"}'), true);
    assert.equal(ctx.__probe('{message:"PGRST205: schema cache"}'), true);
    /* yetki/ağ hataları → FALSE */
    assert.equal(ctx.__probe('{code:"42501",message:"permission denied for view v_park_compare"}'), false, '⭐ 42501 şema eksiği değildir');
    assert.equal(ctx.__probe('{code:401,message:"JWT expired"}'), false);
    assert.equal(ctx.__probe('{message:"Failed to fetch"}'), false);
  });

  test('⭐ dgParkSchemaMissing yetki hatasında DG_PARK_SCHEMA_OK\'i DÜŞÜRMEZ', () => {
    const okBefore = vm.runInContext('DG_PARK_SCHEMA_OK', ctx);
    assert.equal(okBefore, true, 'başlangıçta şema sağlam sayılmalı');
    vm.runInContext('dgParkSchemaMissing({code:"42501",message:"permission denied for view v_park_compare"})', ctx);
    assert.equal(vm.runInContext('DG_PARK_SCHEMA_OK', ctx), true,
      'yetki hatası ölçüm kapısını kapatmamalı (measure.js:278/318 park_id yazmayı bırakıyordu)');
    assert.equal(vm.runInContext('DG_PARK_SCHEMA_WARNED', ctx), false, 'kalıcı şema bayrağı set edilmemeli');
  });

  test('gerçek şema eksiğinde eski davranış korunur (bayrak düşer)', () => {
    vm.runInContext('dgParkSchemaMissing({code:"42P01",message:"relation public.parks does not exist"})', ctx);
    assert.equal(vm.runInContext('DG_PARK_SCHEMA_OK', ctx), false, 'gerçek şema eksiğinde kapı kapanmalı');
    assert.equal(vm.runInContext('DG_PARK_SCHEMA_WARNED', ctx), true);
  });

  test('loadParkCompare yetki hatasında ayrı yol izliyor', () => {
    const w = read('src/services/world.js');
    assert.match(w, /if\(!dgIsSchemaError\(error\)\)\{\s*dgParkCompareDenied\(error\);/, '42501 → dgParkCompareDenied');
    assert.match(w, /function dgParkCompareDenied/, 'dgParkCompareDenied tanımlı olmalı');
    const i = w.indexOf('function dgParkCompareDenied');
    const govde = w.slice(i, w.indexOf('\n/*', i + 10));
    assert.doesNotMatch(govde, /DG_PARK_SCHEMA_OK\s*=\s*false/, 'dgParkCompareDenied şema bayrağına dokunmamalı');
  });
});

describe('6) offline.js ölü kod düzeltmesi', () => {
  test('updateSyncBadge() return\'den ÖNCE çağrılıyor', () => {
    const off = read('src/services/offline.js');
    const i = off.indexOf('async function syncOfflineData');
    assert.ok(i > -1, 'syncOfflineData bulunamadı');
    /* Yalnız !USER bloğuna bak: fonksiyonun başındaki `if (!navigator.onLine)
     * return;` satırı ilk `return;` olduğu için tüm gövdeyi kesmek yanlış
     * pozitife düşürüyordu. */
    const b = off.indexOf('if (!USER)', i);
    assert.ok(b > -1, 'if (!USER) bloğu bulunamadı');
    const blog = off.slice(b, off.indexOf('\n}', b));
    const badge = blog.indexOf('updateSyncBadge();');
    const ret = blog.indexOf('return;');
    assert.ok(badge > -1, 'rozet güncellemesi !USER bloğunda olmalı');
    assert.ok(ret > -1, 'return bulunmalı');
    assert.ok(badge < ret, '⭐ rozet güncellemesi return\'den sonra kalmamalı (ulaşılmaz kod)');
  });
});

describe('7) koordinat doğrulaması — "Null Island" tuzağı', () => {
  test('lat/lon NULL veya boşsa işaretçi ÜRETİLMEZ (eskiden +null===0 ile (0,0)a çiziliyordu)', async () => {
    const { ctx, clusterChildren } = loadMapModule({ rows: [
      ...fakeRows(2),
      { lat: null, lon: 32.6, point_id: 90 },
      { lat: 39.9, lon: null, point_id: 91 },
      { lat: '', lon: '', point_id: 92 },
      { lat: undefined, lon: 32.6, point_id: 93 },
      { lat: 'abc', lon: 32.6, point_id: 94 },
    ] });
    let seen = null;
    await ctx.loadApprovedMarkers({ addLayer() {} }, 3000, (n, rows) => { seen = { n, rows }; });
    assert.equal(seen.n, 2, 'yalnız 2 gerçek koordinat kalmalı');
    assert.equal(clusterChildren.length, 2, 'kümede de 2 işaretçi olmalı');
  });

  test('sınır dışı ve (0,0) koordinatlar reddedilir', () => {
    const { ctx } = loadMapModule();
    const v = (a, b) => ctx.dgValidCoord(a, b);
    assert.equal(v(39.9, 32.6), true);
    assert.equal(v(-33.9, 151.2), true);
    assert.equal(v(0, 0), false, 'Null Island reddedilmeli');
    assert.equal(v(91, 32), false, 'enlem sınırı');
    assert.equal(v(39, 181), false, 'boylam sınırı');
    assert.equal(v(NaN, 32), false);
  });

  test('world.js fitRows aynı doğrulamayı kullanıyor', () => {
    assert.match(read('src/services/world.js'), /filter\(r=>dgValidCoord\(r\.lat,r\.lon\)\)/,
      'fitRows da dgValidCoord kullanmalı (ülke/şehir yakınlaştırması (0,0)a savrulmasın)');
  });
});

describe('8) markercluster eklentisi YOKSA noktalar yine çizilmeli ("listede var, haritada yok" olamaz)', () => {
  test('L.markerClusterGroup tanımsızken düz layerGroup yedeğine düşer', async () => {
    const { ctx, clusterChildren, els } = loadMapModule({ rows: fakeRows(12), noClusterPlugin: true });
    let seen = null;
    await ctx.loadApprovedMarkers({ addLayer() {} }, 3000, (n, rows, err) => { seen = { n, err }; });
    assert.equal(seen.n, 12, 'eklenti yokken de 12 satır işlenmeli');
    assert.equal(seen.err, null);
    assert.equal(clusterChildren.length, 12, '⭐ noktalar düz katmana eklenmeli (boş harita yasak)');
  });

  test('loadLiveMap degrade modda amber uyarı basar, sessiz kalmaz', async () => {
    const { ctx, els } = loadMapModule({ rows: fakeRows(5), noClusterPlugin: true });
    ctx.map = { addLayer() {} };
    await ctx.loadLiveMap();
    assert.match(els.mapLoad.className, /warn/, 'degrade mod amber sınıfla gösterilmeli');
    assert.match(els.mapLoad.textContent, /kümeleme eklentisi yüklenemedi/, 'kullanıcıya sebep söylenmeli');
    assert.match(els.mapLoad.textContent, /5 onaylı kayıt/, 'kayıt sayısı gizlenmemeli');
  });

  test('kaynak kodu yedeği içeriyor (geri kaybolmasın)', () => {
    const m = read('src/services/map.js');
    assert.match(m, /typeof L\.markerClusterGroup==="function"/, 'eklenti varlık kontrolü olmalı');
    assert.match(m, /m\._cluster=L\.layerGroup\(\)/, 'düz katman yedeği olmalı');
    assert.match(m, /m\._clusterDegraded=true/, 'degrade bayrağı set edilmeli');
  });
});

describe('9) çeviri eklentilerine karşı harita koruması (notranslate)', () => {
  test('dört harita konteyneri da notranslate/translate=no taşıyor', () => {
    for (const id of ['map', 'worldMap', 'navMap', 'worldMapLanding']) {
      const re = new RegExp('<div id="' + id + '"[^>]*class="notranslate"[^>]*translate="no"|<div id="' + id + '"[^>]*translate="no"[^>]*class="notranslate"');
      assert.match(idx, re, id + ' konteyneri çeviriye kapatılmalı');
    }
  });
  test('head notranslate meta içeriyor', () => {
    assert.match(idx, /<meta name="google" content="notranslate">/, 'google notranslate meta olmalı');
  });
});
