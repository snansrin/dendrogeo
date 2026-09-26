/* ui-standard.test.mjs — TEK TASARIM SİSTEMİ BEKÇİSİ (2026-09-26)
 *
 * KULLANICI İSTEĞİ: "📡 Konumu Etkinleştir butonunu canlı UI/UX'e göre yap
 * (yüzey analizi gibi); bütün sayfaların temaları, yazı stilleri, yazı
 * renkleri, başlık/alt başlık düzeni aynı olsun, bilimsel literatüre uygun;
 * her sayfa/panel farklı olmasın, butonlar aynı olsun."
 *
 * ÖNCEKİ DURUM (ölçüldü): 11 alt sayfanın HER BİRİ kendi <style> bloğunda
 * Arial gövde yazısı, farklı yeşil (#14532d vs #1e6f4b), farklı buton/başlık
 * ölçüleri tanımlıyordu; kabukta GPS butonu `.btn blue` + inline width ile
 * diğer birincil CTA'lardan ayrışıyordu.
 *
 * ÇÖZÜM: css/ui-standard.css — token anayasası + tipografi ölçeği + bileşen
 * standartları; HER sayfada kendi stilinden SONRA yüklenir (aynı özgüllükte
 * son kural kazanır). Bu test o sözleşmenin GERİ BOZULMAMASINI kilitler.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const css = read('css/ui-standard.css');
const head = read('partials/head.html');
const shell = read('partials/shell.html');
const sw = read('sw.js');

const SUBS = readdirSync(ROOT).filter((d) => {
  if (d.startsWith('.') || d === 'vendor' || d === 'node_modules') return false;
  return existsSync(join(ROOT, d, 'index.html'));
});

describe('ui-standard.css sözleşmesi', () => {
  test('dosya var ve token anayasasını tanımlıyor', () => {
    assert.match(css, /--green:#1e6f4b/, 'kanonik yeşil token');
    assert.match(css, /--f-disp:Fraunces/, 'başlık ailesi Fraunces');
    assert.match(css, /--f-ui:Manrope/, 'gövde ailesi Manrope');
    assert.match(css, /--f-mono:"IBM Plex Mono"/, 'veri ailesi IBM Plex Mono');
  });

  test('tipografi ölçeği bilimsel hiyerarşide (kicker/h1/h2/h3/sub/meta)', () => {
    for (const sel of ['.dg-kicker', '.dg-sub', '.dg-meta', 'h1{', 'h2{', 'h3{', 'h4{'])
      assert.ok(css.includes(sel), sel + ' standartı olmalı');
    assert.match(css, /h1\{[^}]*font-family:var\(--f-disp\)/, 'h1 display ailesi');
    assert.match(css, /h2\{[^}]*font-size:1\.45rem/, 'h2 ölçüsü sabit');
  });

  test('buton TEK aile: .btn + varyantlar + .block', () => {
    assert.match(css, /\.btn\{[^}]*background:var\(--green\)/, 'birincil CTA yeşil');
    for (const v of ['.btn.ghost', '.btn.red', '.btn.blue', '.btn.amber', '.btn.sm', '.btn.lg', '.btn.block'])
      assert.ok(css.includes(v), v + ' varyantı olmalı');
  });

  test('kabukta EN SON yüklenen stil ui-standard.css', () => {
    const links = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3, 'stil listesi bulunmalı');
    assert.match(links[links.length - 1], /ui-standard\.css/, 'son stil ui-standard olmalı');
  });

  test('sw.js PRECACHE çevrimdışı sayfalar için de taşır', () => {
    assert.match(sw, /'\/css\/ui-standard\.css'/, 'PRECACHE girdisi olmalı');
  });
});

describe('11 alt sayfa + kabuk: standart bağlama sözleşmesi', () => {
  test("her alt sayfa ui-standard.css'i kendi <style> bloğundan SONRA bağlar", () => {
    assert.ok(SUBS.length >= 7, 'alt sayfalar bulunmalı: ' + SUBS.join(','));
    for (const d of SUBS) {
      const s = read(join(d, 'index.html'));
      const styleEnd = s.indexOf('</style>');
      const link = s.indexOf('ui-standard.css');
      assert.ok(link > -1, d + ': ui-standard.css bağlı değil');
      if (styleEnd > -1) assert.ok(link > styleEnd, d + ': link kendi style bloğundan SONRA olmalı');
      assert.match(s, /\.\.\/css\/ui-standard\.css/, d + ': göreli yol ../css/ olmalı');
    }
  });

  test('alt sayfalar Arial gövde dayatamaz (ui-standard sonra geldiği için ezilir)', () => {
    /* Kilit: sayfa kendi body fontunu yazsa bile ui-standard SONRA gelir ve
     * aynı özgüllükte son kural kazanır. Sözleşme bozulup link ÖNE alınırsa
     * bu test değil görünüm bozulur → link sırası testi yukarıda kilitli. */
    assert.match(css, /body\{background:var\(--bg\);color:var\(--ink\);font:15px\/1\.65 var\(--f-ui\)\}/,
      "body standardı ui-standard.css'te olmalı");
  });
});

describe('GPS butonu canlı UI dilinde (yüzey analizi kartı gibi)', () => {
  test('buton birincil CTA ailesinden: .btn.block, inline width YOK', () => {
    const m = shell.match(/<button[^>]*onclick="startGps\(\)"[^>]*>/);
    assert.ok(m, 'GPS butonu bulunmalı');
    assert.match(m[0], /class="btn block"/, 'birincil CTA + tam genişlik standardı');
    assert.doesNotMatch(m[0], /style="width:100%"/, 'inline genişlik kaldırılmalı');
    assert.doesNotMatch(m[0], /btn blue/, 'mavi ayrışma kaldırılmalı');
  });

  test('GPS bloğu standart alan kartı: .dg-fieldcard + .dg-kicker + .dg-sub', () => {
    const i = shell.indexOf('id="gpsRing"');
    const blok = shell.slice(i - 400, i + 600);
    assert.match(blok, /class="card dg-fieldcard"/, 'kart standardı');
    assert.match(blok, /class="dg-kicker"/, 'kicker standardı');
    assert.match(blok, /class="dg-sub"/, 'alt başlık standardı');
  });

  test('durum satırı standart alert ailesinden (JS className ile çakışmaz)', () => {
    assert.match(shell, /id="gpsState" class="alert info"/, 'gpsState alert ailesinde kalmalı');
    assert.match(css, /\.alert\.info\{/, "alert.info standardı css'te olmalı");
  });
});
