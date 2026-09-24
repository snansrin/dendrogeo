/* lazylibs.test.mjs — Faz 7 TEMBEL YÜKLEME KİLİTLERİ
 *
 * geotiff (317 KB) ve chart.js (208 KB) artık head'de senkron YOK;
 * lazylibs.js ihtiyaç anında enjekte eder. Bu test:
 *   1) senkron vendor tag'lerinin geri gelmemesini,
 *   2) lazylibs API'sinin (dgEnsureGeoTIFF/dgEnsureChart) varlığını,
 *   3) çağrı noktalarının (dgLcAnalyze, drawChart) ensure kullandığını,
 *   4) QA vm uyumluluğunu (ensure `window.dgEnsureGeoTIFF` VARSA çağrılır),
 *   5) sw.js PRECACHE'in vendor dosyalarını tutmaya devam ettiğini
 *      (çevrimdışı LULC/panel bozulmasın) kilitler.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

describe('tembel vendor yükleme (Faz 7)', () => {
  test('geotiff ve chart.js head’de senkron tag olarak YOK', () => {
    const head = read('partials/head.html');
    assert.ok(!head.includes('vendor/geotiff'), 'geotiff senkron tag’i geri gelmiş');
    assert.ok(!head.includes('vendor/chart.js'), 'chart.js senkron tag’i geri gelmiş');
    assert.ok(head.includes('src/utils/lazylibs.js'), 'lazylibs tag’i eksik');
  });

  test('lazylibs API’si: ensure fonksiyonları + promise paylaşımı + hata sıfırlama', () => {
    const src = read('src/utils/lazylibs.js');
    assert.match(src, /function dgEnsureGeoTIFF\(/);
    assert.match(src, /function dgEnsureChart\(/);
    assert.match(src, /window\.dgEnsureGeoTIFF=dgEnsureGeoTIFF;/);
    assert.match(src, /window\.dgEnsureChart=dgEnsureChart;/);
    assert.match(src, /if\(window\.GeoTIFF\)return Promise\.resolve\(\)/);
    assert.match(src, /if\(window\.Chart\)return Promise\.resolve\(\)/);
    assert.match(src, /DG_GEO_PROMISE=null;throw err/, 'hata sonrası yeniden denenebilmeli');
    assert.match(src, /vendor\/geotiff-2\.1\.3\.js/);
    assert.match(src, /vendor\/chart\.js-4\.5\.1\.js/);
  });

  test('çağrı noktaları ensure kullanıyor ve QA guard’ı yerinde', () => {
    const facade = read('src/services/landcover.js');
    assert.match(facade, /if\(window\.dgEnsureGeoTIFF\)await window\.dgEnsureGeoTIFF\(\);/);
    const dash = read('src/services/dash.js');
    assert.match(dash, /async function drawChart\(/);
    assert.match(dash, /if\(window\.dgEnsureChart\)await window\.dgEnsureChart\(\);/);
  });

  test('sw.js PRECACHE vendor kütüphaneleri tutuyor (çevrimdışı bozulmaz)', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("'/vendor/geotiff-2.1.3.js'"), 'geotiff PRECACHE’ten düşmüş');
    assert.ok(sw.includes("'/vendor/chart.js-4.5.1.js'"), 'chart PRECACHE’ten düşmüş');
    assert.ok(sw.includes("'/src/utils/lazylibs.js'"), 'lazylibs PRECACHE’te yok');
  });
});
