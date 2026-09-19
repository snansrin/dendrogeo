/* vendor-globals.test.mjs — depoya alınan üçüncü taraf kütüphaneler gerçekten
 * beklenen global değişkenleri kuruyor mu?
 *
 * Neden bu test var
 * -----------------
 * c71f239 ile sekiz dosya CDN'den vendor/ altına taşındı. Bu, sitenin EN RİSKLİ
 * değişikliğiydi: yüklenen dosyanın biçimi (UMD mı ESM mi) farklı olsaydı
 * global kurulmaz ve uygulama komple çökerdi. Örnek somut risk:
 *
 *   src/config/supabase.js → supabase.createClient(SB_URL, SB_KEY)
 *
 * jsDelivr `@supabase/supabase-js@2` adresinde package.json'daki "jsdelivr"
 * alanını çözümler. Eğer bu ESM derlemesine işaret etseydi, `supabase` globali
 * hiç oluşmazdı. Dosyanın başlığı kontrol edildi:
 *   "Original file: /npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js"
 * yani UMD — doğru olan bu. Ama başlık yorumu da değişebilir; bu test fiilen
 * yükleyip doğruluyor.
 *
 * Yöntem: her dosya node:vm içinde, tarayıcı global'leri taklit edilerek
 * çalıştırılıyor. UMD sarmalayıcıları `typeof exports === "object"` ve
 * `typeof define === "function"` kontrolleri yaptığı için, ctx'e bunlar
 * KONMUYOR — böylece sarmalayıcı tarayıcı dalına düşüp globalThis'e yazıyor.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor');

const stub = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => '' : stub),
  apply: () => stub,
  construct: () => stub,
  set: () => true,
});

/**
 * Vendor betiklerini SIRAYLA yükler ve global'leri döndürür.
 * index.html'deki yükleme sırası korunur: leaflet → markercluster → supabase →
 * geotiff → chart.js. markercluster `L` globaline bağımlı olduğu için sıra önemli.
 */
function yukleVendor() {
  const ctx = {
    // DOM taklidi — Leaflet ve Chart.js yükleme sırasında bunlara dokunuyor
    window: null, document: stub, navigator: stub, location: stub,
    screen: stub, history: stub, HTMLElement: stub, Element: stub, Node: stub,
    Image: stub, Worker: stub, Blob: stub, FileReader: stub,
    requestAnimationFrame: (f) => setTimeout(f, 0),
    cancelAnimationFrame: clearTimeout, matchMedia: () => stub, getComputedStyle: () => stub,
    self: null, globalThis: null,
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date, Number, Array,
    Object, String, Boolean, Promise, RegExp, Error, Intl, Symbol,
    isNaN, parseInt, parseFloat, TextEncoder, TextDecoder, ArrayBuffer,
    Uint8Array, Uint16Array, Int32Array, Float32Array, Float64Array, DataView,
    // UMD'nin CommonJS/AMD dallarına DÜŞMEMESİ için exports/module/define YOK
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const sira = [
    'leaflet-1.9.4.js',
    'leaflet.markercluster-1.5.3.js',
    'supabase-js-2.116.0.js',
    'geotiff-2.1.3.js',
    'chart.js-4.5.1.js',
  ];
  for (const f of sira) {
    const yol = join(VENDOR, f);
    vm.runInContext(readFileSync(yol, 'utf8'), ctx, { filename: 'vendor/' + f });
  }
  return ctx;
}

describe('vendor/ — global kurulumu (index.html yükleme sırasıyla)', () => {
  const g = yukleVendor();

  test('Leaflet → L globali ve temel fabrikalar', () => {
    assert.equal(typeof g.L, 'object', 'L kurulmadı');
    assert.equal(typeof g.L.map, 'function', 'L.map yok');
    assert.equal(typeof g.L.marker, 'function', 'L.marker yok');
    assert.equal(typeof g.L.tileLayer, 'function', 'L.tileLayer yok');
    assert.equal(typeof g.L.divIcon, 'function', 'L.divIcon yok — map.js bunu kullanıyor');
    assert.equal(typeof g.L.Control, 'function', 'L.Control yok');
    assert.equal(g.L.version, '1.9.4');
  });

  test('MarkerCluster → L.MarkerClusterGroup ve L.markerClusterGroup', () => {
    // markercluster `L` globaline YAZAR; ayrıca Leaflet.markercluster ad alanı
    assert.equal(typeof g.L.MarkerClusterGroup, 'function', 'L.MarkerClusterGroup yok');
    assert.equal(typeof g.L.markerClusterGroup, 'function', 'L.markerClusterGroup yok');
    assert.equal(typeof g.Leaflet.markercluster, 'object');
  });

  test('⭐ Supabase → supabase.createClient (UMD, ESM değil)', () => {
    assert.equal(typeof g.supabase, 'object', 'supabase globali kurulmadı — ESM derlemesi yüklenmiş olabilir');
    assert.equal(typeof g.supabase.createClient, 'function',
      'supabase.createClient yok; src/config/supabase.js bunu çağırıyor');
  });

  test('GeoTIFF → GeoTIFF.fromUrl (landcover.js:695 bunu şart koşuyor)', () => {
    assert.equal(typeof g.GeoTIFF, 'object', 'GeoTIFF kurulmadı');
    assert.equal(typeof g.GeoTIFF.fromUrl, 'function',
      'GeoTIFF.fromUrl yok; landcover.js COG okumayı bununla yapıyor');
    assert.equal(typeof g.GeoTIFF.fromBlob, 'function');
  });

  test('Chart.js → Chart globali', () => {
    assert.equal(typeof g.Chart, 'function', 'Chart kurulmadı');
    assert.match(String(g.Chart.version || ''), /^4\./, 'Chart sürümü: ' + g.Chart.version);
  });
});

describe('vendor/ — dosya bütünlüğü', () => {
  const beklenen = [
    'leaflet-1.9.4.css', 'leaflet-1.9.4.js',
    'MarkerCluster-1.5.3.css', 'MarkerCluster.Default-1.5.3.css',
    'leaflet.markercluster-1.5.3.js',
    'supabase-js-2.116.0.js', 'geotiff-2.1.3.js', 'chart.js-4.5.1.js',
  ];

  test('index.html ve sw.js tarafından beklenen 8 dosya mevcut', () => {
    const varOlan = readdirSync(VENDOR);
    for (const f of beklenen) {
      assert.ok(varOlan.includes(f), `vendor/${f} eksik`);
    }
  });

  test('⭐ index.html içindeki HER vendor yolu diskte var', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const yollar = [...html.matchAll(/(?:src|href)="(vendor\/[^"?]+)/g)].map((m) => m[1]);
    assert.ok(yollar.length >= 8, 'vendor referansı bulunamadı: ' + yollar.length);
    for (const y of yollar) {
      assert.ok(readFileSync(join(ROOT, y)).length > 0, `${y} boş ya da yok`);
    }
  });

  test('⭐ sw.js CORE_ASSETS içindeki her /vendor/ yolu diskte var', () => {
    const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
    const blok = sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1];
    const yollar = [...blok.matchAll(/'(\/vendor\/[^']+)'/g)].map((m) => m[1]);
    assert.ok(yollar.length >= 8, 'CORE_ASSETS içinde vendor yolu yok');
    for (const y of yollar) {
      assert.ok(readFileSync(join(ROOT, y.slice(1))).length > 0, `CORE_ASSETS: ${y} diskte yok`);
    }
  });

  test('index.html ve sw.js aynı vendor listesini kullanıyor (sapma yok)', () => {
    const html = new Set([...readFileSync(join(ROOT, 'index.html'), 'utf8')
      .matchAll(/(?:src|href)="(vendor\/[^"?]+)/g)].map((m) => '/' + m[1]));
    const sw = new Set([...readFileSync(join(ROOT, 'sw.js'), 'utf8')
      .matchAll(/'(\/vendor\/[^']+)'/g)].map((m) => m[1]));
    const htmlEksik = [...html].filter((x) => !sw.has(x));
    const swEksik = [...sw].filter((x) => !html.has(x));
    assert.deepEqual(htmlEksik, [], 'index.html yüklüyor ama precache\'te yok: ' + htmlEksik);
    assert.deepEqual(swEksik, [], 'precache\'te var ama index.html yüklemiyor: ' + swEksik);
  });

  test('CSS dosyaları gerçekten CSS (boş ya da HTML hata sayfası değil)', () => {
    for (const f of beklenen.filter((x) => x.endsWith('.css'))) {
      const icerik = readFileSync(join(VENDOR, f), 'utf8');
      assert.ok(!/^\s*<(!doctype|html)/i.test(icerik), `${f} HTML hata sayfası gibi görünüyor`);
      assert.ok(icerik.includes('{') && icerik.includes('}'), `${f} CSS kuralı içermiyor`);
    }
  });

  test('⭐ hiçbir dosya unpkg/jsdelivr\'den YÜKLENMİYOR', () => {
    /* Denetlenen şey "kaynak olarak yüklenen URL", yoksa sw.js'teki hostname
     * eşleştirmeleri ya da açıklayıcı yorumlar yanlış alarm verirdi. */
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const kaynaklar = [...html.matchAll(/(?:src|href)="(https?:\/\/[a-z0-9.\-]+)/g)].map((m) => m[1]);
    const cdn = kaynaklar.filter((h) => /unpkg\.com|jsdelivr\.net/.test(h));
    assert.deepEqual(cdn, [], 'index.html hâlâ CDN\'den yüklüyor: ' + cdn);

    const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
    const blok = sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1];
    const pre = [...blok.matchAll(/'(https?:\/\/[^']+)'/g)].map((m) => m[1]);
    const preCdn = pre.filter((h) => /unpkg\.com|jsdelivr\.net/.test(h));
    assert.deepEqual(preCdn, [], 'CORE_ASSETS hâlâ CDN yolu içeriyor: ' + preCdn);
    // Turnstile bilerek CDN'de bırakıldı (Cloudflare kendi sürümlüyor)
    assert.ok(pre.some((h) => /challenges\.cloudflare\.com/.test(h)),
      'Turnstile precache\'te olmalı');
  });
});
