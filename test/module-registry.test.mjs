/* module-registry.test.mjs — MODÜL KAYIT BEKÇİSİ
 *
 * Bu depoda bir dosyanın "sisteme kayıtlı" olması 4 ayrı listeye bağlıydı:
 *   1) index.html        → <script src> / <link href> tag'leri (+ ?v= hash)
 *   2) sw.js             → CORE_ASSETS (çevrimdışı PRECACHE)
 *   3) test/ui-audit     → FILES (ölü buton denetiminin taradığı küme)
 *   4) .github/ci.yml    → dağıtım sürüklenme listesi
 * Yeni bir modül eklendiğinde bu listelerden biri unutulursa site SESSİZCE
 * bozulur (çevrimdışı çalışmaz, denetim kör kalır, bayat cache servis edilir).
 *
 * Bu test tüm zinciri index.html + diskten TÜRETİR ve tutarlılığı kilitler:
 *   · index.html'deki her src/css/vendor varlığı diskte olmalı
 *   · her ?v= değeri dosyanın sha256'sının ilk 8 karakteri olmalı
 *   · index.html'deki her varlık sw.js CORE_ASSETS'te olmalı
 *   · CORE_ASSETS'teki her yerel dosya diskte olmalı
 *   · src/** altındaki HER .js ya index.html'de tag'le ya da başka bir
 *     kaynak dosyada dinamik yükleme hedefi olarak geçmeli (lazy modüller)
 *     VE CORE_ASSETS'te olmalı
 *   · css/** altındaki her .css index.html'de link'li VE CORE_ASSETS'te olmalı
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

const sha8 = (p) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex').slice(0, 8);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out;
}

/* index.html'deki tüm yerel varlıklar: path + ?v= değeri */
const assets = [];
for (const m of html.matchAll(/(?:src|href)="((?:src|css|vendor)\/[^"?]+)(?:\?v=([A-Za-z0-9]+))?"/g)) {
  assets.push({ path: m[1], v: m[2] || null });
}

/* sw.js CORE_ASSETS dizisinin yerel girdileri */
const coreBlock = sw.slice(sw.indexOf('const CORE_ASSETS'), sw.indexOf('];', sw.indexOf('const CORE_ASSETS')));
const coreAssets = [...coreBlock.matchAll(/'\/([^']+)'/g)].map((m) => m[1]);

describe('index.html ↔ disk ↔ ?v= tutarlılığı', () => {
  test('her asset diski gösteriyor', () => {
    const yok = assets.filter((a) => !existsSync(join(ROOT, a.path))).map((a) => a.path);
    assert.deepEqual(yok, [], 'diskte olmayan asset: ' + yok.join(', '));
  });

  test('src/css varlıklarının ?v= değeri içerik hash’i (version-sync şeması)', () => {
    const bozuk = assets
      .filter((a) => a.path.startsWith('src/') || a.path.startsWith('css/'))
      .filter((a) => a.v !== sha8(a.path))
      .map((a) => `${a.path} ?v=${a.v} ≠ ${sha8(a.path)}`);
    assert.deepEqual(bozuk, [], 'hash uyumsuz: ' + bozuk.join(' | ') + ' → node scripts/version-sync.mjs --write');
  });
});

describe('service worker CORE_ASSETS kaydı', () => {
  test('index.html’deki her yerel asset CORE_ASSETS’te', () => {
    const eksik = [...new Set(assets.map((a) => a.path))].filter((p) => !coreAssets.includes(p));
    assert.deepEqual(eksik, [], 'CORE_ASSETS’te yok (çevrimdışı bozulur): ' + eksik.join(', '));
  });

  test('CORE_ASSETS’teki her yerel dosya diskte var', () => {
    const yok = coreAssets.filter((p) => !existsSync(join(ROOT, p)));
    assert.deepEqual(yok, [], 'CORE_ASSETS hayalet girdi: ' + yok.join(', '));
  });

  test('src/** altındaki her .js CORE_ASSETS’te (tag’siz/tembel modüller dahil)', () => {
    const srcJs = walk(join(ROOT, 'src')).filter((p) => p.endsWith('.js'));
    const eksik = srcJs.filter((p) => !coreAssets.includes(p));
    assert.deepEqual(eksik, [], 'çevrimdışı pakete eklenmemiş src modülü: ' + eksik.join(', '));
  });

  test('css/** altındaki her .css CORE_ASSETS’te', () => {
    const cssFiles = walk(join(ROOT, 'css')).filter((p) => p.endsWith('.css'));
    const eksik = cssFiles.filter((p) => !coreAssets.includes(p));
    assert.deepEqual(eksik, [], 'çevrimdışı pakete eklenmemiş css: ' + eksik.join(', '));
  });
});

describe('modül erişilebilirliği', () => {
  test('her src .js ya index.html’de tag’li ya bir kaynaktan dinamik yükleniyor', () => {
    const srcJs = walk(join(ROOT, 'src')).filter((p) => p.endsWith('.js'));
    const kaynaklar = srcJs.map((p) => readFileSync(join(ROOT, p), 'utf8')).join('\n') + html;
    const yetim = srcJs.filter((p) => !assets.some((a) => a.path === p) && !kaynaklar.includes(p));
    assert.deepEqual(yetim, [], 'hiçbir yerden yüklenmeyen yetim modül: ' + yetim.join(', '));
  });

  test('her css/*.css index.html’de link’li', () => {
    const cssFiles = walk(join(ROOT, 'css')).filter((p) => p.endsWith('.css'));
    const eksik = cssFiles.filter((p) => !assets.some((a) => a.path === p));
    assert.deepEqual(eksik, [], 'index.html’de link’i olmayan css: ' + eksik.join(', '));
  });
});
