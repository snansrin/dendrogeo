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
