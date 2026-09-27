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
const idx = read('index.html');

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

  test('⭐ ui-standard.css uygulama kabuğuna SIZMAZ (yalnız alt sayfalar)', () => {
    /* 2026-09-27: eleman seviyesi kurallar (h2/p/td/badge…) Park Karşılaştırma
     * kartının barlarını ve lead satırını bozdu; dosya alt sayfalara çekildi. */
    assert.ok(!/ui-standard\.css/.test(head), 'index.html head ui-standard bağlamamalı');
    assert.ok(!/ui-standard\.css/.test(idx), 'index.html artifaktı da bağlamamalı');
  });

  test("kabuğun ihtiyaç duyduğu .dg-sub style.css’te yaşar", () => {
    assert.match(read('css/style.css'), /\.dg-sub\{/, "dg-sub uygulama CSS’inde olmalı");
  });

  test("sw.js PRECACHE ui-standard’ı taşır (alt sayfalar çevrimdışı da standart)", () => {
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

describe('GPS butonu canlı UI dilinde (🌿 Yüzey Örtüsü Analizi kartıyla birebir)', () => {
  test('buton LULC ile aynı aileden: .dg-png-btn.primary + id gpsBtn', () => {
    const m = shell.match(/<button[^>]*onclick="startGps\(\)"[^>]*>/);
    assert.ok(m, 'GPS butonu bulunmalı');
    assert.match(m[0], /id="gpsBtn"/, 'canlı durum için id şart');
    assert.match(m[0], /class="dg-png-btn primary"/, 'LULC butonuyla aynı aile');
    assert.doesNotMatch(m[0], /style="width:100%"/, 'inline genişlik yok');
    assert.doesNotMatch(m[0], /btn blue/, 'ayrı tema yok');
  });

  test('kart LULC kartıyla aynı iskelet: dg-png-card/head/kicker/title/sub/badge', () => {
    const i = shell.indexOf('id="gpsRing"');
    const blok = shell.slice(i - 700, i + 700);
    for (const c of ['dg-png-card', 'dg-png-head', 'dg-png-kicker', 'dg-png-title', 'dg-png-sub', 'dg-png-badge'])
      assert.ok(blok.includes(c), c + ' GPS kartında olmalı');
  });

  test('canlı durum LULC deseniyle birebir: disabled + ⏳ + oldText + opacity', () => {
    const m = read('src/services/measure.js');
    assert.match(m, /function dgGpsBtnBusy\(on\)/, 'canlı buton yardımcısı');
    assert.match(m, /"⏳ Konum alınıyor…"/, 'LULC ile aynı ⏳ kalıbı');
    assert.match(m, /b\.dataset\.oldText=b\.innerHTML/, 'eski metni sakla');
    assert.match(m, /b\.style\.opacity="\.65"/, 'aynı solukluk');
    assert.match(m, /b\.style\.cursor="wait"/, 'aynı imleç');
    assert.match(m, /const onOk=p=>\{dgGpsBtnBusy\(false\);/, 'başarıda buton geri gelir');
    assert.match(m, /if\(e\)dgGpsBtnBusy\(false\);/, 'hatada buton geri gelir');
  });

  test("yeni tema/animasyon YOK: css'e keyframes/spin eklenmedi", () => {
    assert.doesNotMatch(css, /@keyframes/, 'ui-standard.css animasyon getirmemeli');
    const pp = read('css/park-panel.css');
    assert.match(pp, /\.dg-png-btn\{/, 'buton stili mevcut aileden gelir, yeniden tanımlanmaz');
    assert.doesNotMatch(css, /\.dg-png-btn\{/, 'ui-standard mevcut bileşeni EZMEMELİ');
  });

  test('durum satırı ve rozet standart ailelerden', () => {
    assert.match(shell, /id="gpsState" class="alert info"/, 'gpsState alert ailesinde');
    assert.match(shell, /id="gpsBadge"/, 'canlı rozet');
    const m = read('src/services/measure.js');
    assert.match(m, /bd\.className="dg-png-badge "/, 'rozet LULC badge diliyle güncellenir');
  });
});
