/* ui-audit.test.mjs — ÖLÜ BUTON / EKSİK ID / SEKME REGRESYON DENETİMİ
 *
 * Neden: projede iki kez "ölü buton" vakası yaşandı (downloadParkImage ve
 * arriveWp hiç tanımlanmamıştı; kullanıcı tıklayınca ReferenceError). Bu test
 * tüm onclick/onchange/oninput handler'larını ve $("id") referanslarını
 * statik olarak tarar; tanımsız olan varsa CI kırmızı yanar.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'index.html',
  'src/config/supabase.js', 'src/config/constants.js', 'src/config/species.js',
  'src/utils/geo.js', 'src/utils/truncation.js',
  'src/services/allometry.js', 'src/services/auth.js', 'src/services/export.js',
  'src/services/offline.js', 'src/services/admin.js', 'src/services/world.js',
  'src/services/measure.js', 'src/services/map.js', 'src/services/landcover.js',
  'src/services/gridplan.js', 'src/services/dash.js',
];
const src = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
const all = Object.values(src).join('\n');

const defined = new Set();
for (const m of all.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
for (const m of all.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
for (const m of all.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);

describe('ölü buton denetimi', () => {
  test('⭐ tüm onclick/onchange/oninput handler\'ları tanımlı', () => {
    const called = new Set();
    for (const m of all.matchAll(/on(?:click|change|input|submit|keyup|keydown)\s*=\s*\\?"?\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
      called.add(m[1]);
    }
    const missing = [...called].filter((n) => !defined.has(n) && n !== 'if');
    assert.deepEqual(missing, [], 'tanımsız handler: ' + missing.join(', '));
  });

  test('bilinen ölü butonlar geri gelmemeli', () => {
    assert.ok(defined.has('downloadParkImage'), 'downloadParkImage tanımlı olmalı');
    assert.ok(defined.has('arriveWp'), 'arriveWp tanımlı olmalı');
  });
});

describe('ID ve sekme denetimi', () => {
  test('$("id") referanslarının tamamı sayfada/template\'te tanımlı', () => {
    const refs = new Set();
    for (const m of all.matchAll(/\$\(\s*["']([\w-]+)["']\s*\)/g)) refs.add(m[1]);
    for (const m of all.matchAll(/getElementById\(\s*["']([\w-]+)["']\s*\)/g)) refs.add(m[1]);
    const ids = new Set();
    for (const m of all.matchAll(/id\s*=\s*\\?"([\w-]+)\\?"/g)) ids.add(m[1]);
    const missing = [...refs].filter((i) => !ids.has(i));
    assert.deepEqual(missing, [], 'eksik id: ' + missing.join(', '));
  });

  test('go() hedeflerinin tümü için v-* bölümü var', () => {
    const targets = new Set();
    for (const m of all.matchAll(/go\(\s*['"]([\w-]+)['"]\s*\)/g)) targets.add(m[1]);
    const html = src['index.html'];
    for (const t of targets) {
      assert.ok(html.includes(`id="v-${t}"`), 'v-' + t + ' bölümü yok');
    }
  });

  test('yan menü öğe sayısı go() indeks haritasıyla uyumlu (10)', () => {
    const html = src['index.html'];
    const items = (html.match(/class="item/g) || []).length;
    assert.equal(items, 10);
    assert.match(html, /users:9/);
  });
});

describe('erişilebilirlik cilası', () => {
  const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
  test('klavye odağı görünür (:focus-visible)', () => {
    assert.match(css, /:focus-visible/);
  });
  test('hareket hassasiyeti desteği (prefers-reduced-motion)', () => {
    assert.match(css, /prefers-reduced-motion/);
  });
});

describe('eski format koruması (kullanıcı tercihi 2026-09-20)', () => {
  const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const gp = readFileSync(join(ROOT, 'src/services/gridplan.js'), 'utf8');
  const dash = readFileSync(join(ROOT, 'src/services/dash.js'), 'utf8');

  test('global h2/h3 tipografi override YOK (site eski formatta)', () => {
    assert.ok(!/\nh2\{/.test(css), 'global h2 kuralı geri gelmemeli');
    assert.ok(!/\nh3\{/.test(css), 'global h3 kuralı geri gelmemeli');
  });

  test('bölüm başlıklarının eski inline boyutları duruyor', () => {
    assert.match(html, /<h2 style="font-size:1\.6rem">Genel Bakış/);
    assert.match(html, /<h2 style="font-size:1\.15rem">Kişisel Ağaç Analizi/);
    assert.match(html, /<h2 class="disp" style="margin-bottom:16px">Yeni Ölçüm/);
  });

  test('panel başlıkları eski stilinde (gri kicker, sans title)', () => {
    assert.match(gp, /\.dg-png-kicker\{[\s\S]{0,120}?color:var\(--mut\)/);
    assert.ok(!/\.dg-png-title\{[\s\S]{0,80}?Fraunces/.test(gp), 'panel title Fraunces olmamalı');
  });

  test('⭐ landing yayılması kalıcı önlem: .wrap override YOK', () => {
    // .wrap{max-width:1120px;margin:0 auto} sitenin ortalanmış düzenidir;
    // max-width:100% override'ı landing'i kenarlara yaymıştı.
    assert.match(css, /\.wrap\{max-width:1120px;margin:0 auto/);
    assert.ok(!css.includes('.wrap,.hero-art'), 'wrap override kalıntısı');
    assert.ok(!/\.wrap\{max-width:100%\}/.test(css), 'wrap max-width:100% override');
  });

  test('⭐ tür barları Grup Dağılımı ile AYNI stilde (14px yuvarlak bar)', () => {
    // Grup Dağılımı barı: display:flex;height:14px;border-radius:7px;background:var(--line)
    const grupBar = 'display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line)';
    assert.ok(dash.includes(grupBar), 'grup barı markup’ı');
    const n = dash.split(grupBar).length - 1;
    assert.ok(n >= 2, 'tür listesi de aynı barı kullanmalı, bulunan: ' + n);
    assert.ok(!dash.includes('class="sp-bar"'), 'sp-bar kalıntısı');
    assert.ok(!css.includes('.sp-bar{'), 'sp-bar css kalıntısı');
  });
});

describe('saha konforu: PWA kurulum + senkron rozeti + yazdırma', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const off = readFileSync(join(ROOT, 'src/services/offline.js'), 'utf8');
  const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');

  test('üst barda senkron rozeti ve kur butonu var', () => {
    assert.match(html, /id="syncBadge"/);
    assert.match(html, /id="installBtn"/);
    assert.match(html, /onclick="dgInstallApp\(\)"/);
  });

  test('beforeinstallprompt yakalanıyor ve buton gorunur oluyor', () => {
    assert.match(off, /addEventListener\("beforeinstallprompt"/);
    assert.match(off, /window\.dgInstallApp=dgInstallApp;/);
  });

  test('rozet kuyruk sayısını gösteriyor ve iki yerde güncelleniyor', () => {
    assert.match(off, /async function updateSyncBadge\(\)/);
    const calls = (off.match(/updateSyncBadge\(\);/g) || []).length;
    assert.ok(calls >= 2, 'save ve sync sonrası güncellenmeli, bulunan: ' + calls);
  });

  test('yazdırma stilleri var (rapor kağıda temiz çıkar)', () => {
    assert.match(css, /@media print/);
    assert.match(css, /\.view\.on\{display:block\}/);
  });
});
