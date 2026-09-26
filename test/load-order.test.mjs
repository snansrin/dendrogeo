/* load-order.test.mjs — TAM SAYFA YÜKLEME SIRASI SMOKE TESTİ
 *
 * index.html'in yüklediği TÜM src/* script'lerini, TARAYICI SIRASIYLA tek bir
 * node:vm bağlamında çalıştırır. Bu, projedeki en kapsamlı yapısal kilittir:
 *
 *   1) Global lexical çakışma yakalanır: iki dosya aynı adı üst düzeyde
 *      let/const ile bildirirse vm, tarayıcıdakiyle aynı SyntaxError'ı verir
 *      ("Identifier 'X' has already been declared"). Statik regex bunu
 *      fonksiyon içi bildirimlerden ayırt edemez; vm GERÇEK semantiktir.
 *   2) Yükleme-anı kodu (supabase createClient, auth.js recoveryModal sabiti,
 *      lazylibs window kayıtları, shell.js boot() çağrısı) stub DOM ile de
 *      olsa gerçekten ÇALIŞIR — import sırası bozuksa burada patlar.
 *   3) Beklenen global API yüzeyi doğrulanır ($, esc, sb, toast, boot,
 *      drawPark, dgLcAnalyze, dgEnsure*, window.DG_LANDCOVER facade…).
 *
 * DOM/ağ Proxy stub'dır (test-harness.mjs ile aynı yaklaşım); setTimeout
 * no-op'tur ki boot()'un gecikmeli senkron çağrıları test sürecini uzatmasın.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const stub = new Proxy(function () {}, {
  get: (t, p) => {
    if (p === Symbol.toPrimitive) return () => '';
    if (p === Symbol.iterator) return function* () {};
    return stub;
  },
  apply: () => stub, construct: () => stub, set: () => true, has: () => false,
});

function makeCtx() {
  const ctx = {
    window: null, document: stub, navigator: stub, location: stub,
    localStorage: stub, sessionStorage: stub, indexedDB: stub, caches: stub,
    L: stub, Chart: stub, supabase: stub, GeoTIFF: stub,
    alert: () => {}, confirm: () => false,
    console: { log() {}, warn() {}, error() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    URL, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date, Number, Array,
    Object, String, Boolean, Promise, RegExp, Error, Intl, isNaN, parseInt,
    parseFloat, TextEncoder, TextDecoder, AbortController,
    fetch: () => Promise.reject(new Error('test: ağ yok')),
    addEventListener: () => {}, removeEventListener: () => {},
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function scriptSirasi() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  /* 2026-09-25 (Faz 8): tüm script'ler artık `defer` ile yükleniyor → etiket
   * biçimi <script src="…" defer>. Regex attribute sırasından bağımsız. */
  return [...html.matchAll(/<script\s+src="(src\/[^"?]+)[^>]*><\/script>/g)].map((m) => m[1]);
}

/* LULC zinciri artık index.html'de DEĞİL: lazylibs.js → dgEnsureLulc() ilk
 * kullanımda sırayla enjekte ediyor (Faz 8). Facade sözleşmesi hâlâ
 * kilitlenmeli, o yüzden zincir burada ELLE yüklenir — hem de tam olarak
 * dgEnsureLulc'nin kullandığı sırayla (DG_LULC_CHAIN). */
const LULC_ZINCIRI = [
  'src/services/lc-config.js', 'src/services/lc-geo.js', 'src/services/lc-stac.js',
  'src/services/lc-engine.js', 'src/services/lc-osm.js', 'src/services/lc-patches.js',
  'src/ui/lc-report.js', 'src/services/landcover.js',
];

/* const/let üst düzey bildirimleri ctx NESNESİNDE görünmez (global lexical
 * scope) — typeof ile bağlam içinde değerlendirerek yokla. */
function definedInCtx(ctx, name) {
  if (typeof ctx[name] !== 'undefined') return true;
  try { return vm.runInContext(`typeof ${name} !== 'undefined'`, ctx); } catch { return false; }
}

describe('tam sayfa yükleme sırası (vm smoke)', () => {
  const siralama = scriptSirasi();
  const ctx = makeCtx();
  const hatalar = [];

  for (const f of siralama) {
    try {
      vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f });
    } catch (e) {
      hatalar.push(`${f}: ${e.message}`);
    }
  }

  test('tüm src script’leri tarayıcı sırasıyla hatasız yükleniyor', () => {
    assert.ok(siralama.length >= 22, 'beklenenden az script bulundu: ' + siralama.length);
    assert.deepEqual(hatalar, [], 'yükleme hatası: ' + hatalar.join(' | '));
  });

  test('⭐ tüm script etiketleri defer ile yükleniyor (ilk çizimi bloklamasın)', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const etiketler = [...html.matchAll(/<script\s+src="(?:src|vendor)\/[^"]+"[^>]*>/g)].map((m) => m[0]);
    assert.ok(etiketler.length >= 30, 'script etiketi bulunamadı: ' + etiketler.length);
    const defersiz = etiketler.filter((t) => !/\bdefer\b/.test(t));
    assert.deepEqual(defersiz, [], 'defer eksik (senkron script HTML ayrıştırmayı durdurur): ' + defersiz.join(' | '));
  });

  test('⭐ LULC zinciri index.html’de DEĞİL (tembel) ama dgEnsureLulc’de sıralı', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    for (const f of LULC_ZINCIRI) {
      assert.ok(!html.includes('src="' + f), f + ' hâlâ index.html’de — tembel yüklenmeli');
    }
    const lazy = readFileSync(join(ROOT, 'src/utils/lazylibs.js'), 'utf8');
    assert.match(lazy, /const DG_LULC_CHAIN=\[/);
    for (const f of LULC_ZINCIRI) assert.ok(lazy.includes('"' + f + '"'), 'DG_LULC_CHAIN’de yok: ' + f);
    /* sıra önemli: facade en son */
    const idxs = LULC_ZINCIRI.map((f) => lazy.indexOf('"' + f + '"'));
    assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b), 'zincir sırası bozuk');
    assert.match(lazy, /window\.dgEnsureLulc=dgEnsureLulc;/);
    assert.match(lazy, /s\.async=false/, 'yürütme sırası belge sırasına sabitlenmeli');
  });

  test('analiz köprüsü zinciri gerçekten bekliyor', () => {
    const pe = readFileSync(join(ROOT, 'src/ui/park-export.js'), 'utf8');
    const fn = pe.slice(pe.indexOf('async function runLandCoverAnalysis'), pe.indexOf('function downloadParkImage') > -1 ? pe.indexOf('function downloadParkImage') : pe.length);
    assert.match(fn, /await dgEnsureLulc\(\)/);
    assert.match(fn, /yüklenemedi/, 'yükleme hatası kullanıcıya söylenmeli');
  });

  test('global lexical çakışma yok (vm instantiation geçti)', () => {
    const lex = hatalar.filter((h) => /already been declared/i.test(h));
    assert.deepEqual(lex, [], lex.join(' | '));
  });

  test('⭐ beklenen global API yüzeyi eksiksiz', () => {
    /* LULC zincirini dgEnsureLulc'nin sırasıyla yükle (tembel olduğu için
     * index.html'de yok) — aksi hâlde dgLcAnalyze/DG_LANDCOVER bulunamaz. */
    for (const f of LULC_ZINCIRI) {
      try { vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f }); }
      catch (e) { hatalar.push(`${f}: ${e.message}`); }
    }
    const beklenen = [
      '$', 'esc', 'sb', 'SPECIES_DATA', 'rho',           // config
      'hav', 'brg', 'dgIsTruncated',                      // utils
      'dgEnsureGeoTIFF', 'dgEnsureChart',                 // lazylibs (Faz 7)
      'calc',                                             // allometry
      'toast', 'boot', 'initLanding', 'startShell', 'go', // ui
      'USER', 'PROFILE', 'map', 'worldMapL',              // state (lexical!)
      'showAuth', 'doLogin', 'trackVisit', 'loadVisitStats',
      'sendDataRequest', 'loadUsers', 'fullBackup',       // yönetim zinciri (Faz 6)
      'saveMeas', 'startGps', 'arriveWp', 'loadApprovedMarkers', 'renderAnalysis',
      'overpassRequest', 'queryPark', 'pointInPolygon', 'cellInsidePark', // park zinciri
      'buildGrid', 'drawPark', 'toggleParkMode', 'downloadParkImage', 'runLandCoverAnalysis',
      'dgLcAnalyze', 'dgLcFindTiles', 'dgLcProcessTile', 'dgLcRefineWater', 'dgLcRenderReport',
      'loadAdmin', 'exportCSV', 'syncOfflineData',
    ];
    const eksik = beklenen.filter((n) => !definedInCtx(ctx, n));
    assert.deepEqual(eksik, [], 'tanımsız global: ' + eksik.join(', '));
  });

  test('window.DG_LANDCOVER facade sözleşmesi tam', () => {
    const api = ctx.window.DG_LANDCOVER;
    assert.ok(api, 'DG_LANDCOVER yok');
    for (const k of ['analyze', 'clear', 'getLast', 'isGreen', 'hasGreen', 'downloadClassCSV', 'downloadCellsGeoJSON']) {
      assert.equal(typeof api[k], 'function', 'facade.' + k + ' eksik');
    }
    assert.equal(typeof ctx.window.DG_LANDCOVER_RENDER_REPORT, 'function');
  });

  test('window köprü kayıtları (onclick hedefleri) yerinde', () => {
    for (const k of ['dgToggleParkMode', 'downloadParkImage', 'runLandCoverAnalysis',
                     'downloadLandCoverClassCSV', 'downloadLandCoverCellsGeoJSON',
                     'dgInstallApp', 'updateSyncBadge', 'setGreenOnly', 'clearPark', 'bindParkClick']) {
      assert.equal(typeof ctx.window[k], 'function', 'window.' + k + ' eksik');
    }
  });
});
