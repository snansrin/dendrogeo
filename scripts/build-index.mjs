#!/usr/bin/env node
/* build-index.mjs — index.html ÜRETİCİSİ (Faz 3: landing gerçekten ayrı modül)
 *
 * index.html artık ELLE düzenlenmez; partials/ altındaki dört modülden
 * ÜRETİLİR ve repo'ya artifakt olarak commit edilir (GitHub Pages doğrudan
 * onu servis eder — SEO/JSON-LD için hiçbir şey değişmez):
 *
 *   partials/head.html     → doctype … </head> + <body> + #toastWrap
 *   partials/landing.html  → ★ LANDING MODÜLÜ: <div id="landing"> … </div>
 *   partials/shell.html    → uygulama kabuğu: <div id="shell"> … modaller
 *   partials/boot.html     → src/ui/* script tag'leri + </body></html>
 *
 * Kullanım:
 *   node scripts/build-index.mjs --write   → partials'tan index.html üret
 *                                            (?v= hash'leri içerikten tazelenir)
 *   node scripts/build-index.mjs --check   → üretilmiş hâl disktekiyle birebir
 *                                            aynı mı? (CI; değilse exit 1)
 *   node scripts/build-index.mjs --split   → TERS YÖN: elle düzenlenmiş
 *                                            index.html'den partials'ı yeniden
 *                                            üretir (GitHub web UI alışkanlığı
 *                                            sigortası; sonrasında --write ile
 *                                            tur atılır, byte-farkı çıkmaz)
 *
 * Birleştirme saf concatenation'dır: head+landing+shell+boot = index.html
 * (bayt bayt). ?v= sürüm hash'leri birleştirme sırasında dosya içeriğinin
 * sha256'sından yeniden hesaplanır — version-sync.mjs ile aynı şema; yani
 * partials'taki ?v= değerlerinin bayat kalması zararsızdır.
 *
 * İş akışı:  landing değişikliği  → partials/landing.html (+css/landing.css,
 *            src/ui/landing.js) düzenle → npm run build → commit (index.html
 *            DAHİL). Uygulama değişikliği → partials/shell.html veya ilgili
 *            src modülü → npm run build → commit.
 *            Elle index.html düzenlersen: node scripts/build-index.mjs --split
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PDIR = join(ROOT, 'partials');
const PARTIALS = ['head.html', 'landing.html', 'shell.html', 'boot.html'];
const INDEX = join(ROOT, 'index.html');

const mode = process.argv.includes('--write') ? 'write'
           : process.argv.includes('--split') ? 'split'
           : process.argv.includes('--check') ? 'check'
           : 'check';

const v8 = (rel) => createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex').slice(0, 8);

/* ?v= değerlerini içerik hash'iyle tazele (version-sync.mjs ile aynı regex) */
function refreshHashes(text) {
  return text.replace(/((?:src|href)=")((?:src|css|vendor)\/[^"?]+)(\?v=)([A-Za-z0-9]+)(")/g,
    (m, a, path, c, _old, d) => {
      const rel = path.split('?')[0];
      if (!existsSync(join(ROOT, rel))) return m;
      return a + path + c + v8(rel) + d;
    });
}

function assemble() {
  let out = '';
  for (const f of PARTIALS) {
    const p = join(PDIR, f);
    if (!existsSync(p)) {
      console.error(`🔴 partials/${f} yok — önce: node scripts/build-index.mjs --split`);
      process.exit(1);
    }
    out += readFileSync(p, 'utf8');
  }
  return refreshHashes(out);
}

/* index.html'i kararlı çapa noktalarından dörde böler */
const ANCHORS = [
  ['toast',  '<div id="toastWrap"></div>'],
  ['landing', '<div id="landing">'],
  ['shell',  '<div id="shell">'],
  ['boot',   '<script src="src/ui/state.js'],
];
function splitIndex(text) {
  const pos = {};
  for (const [name, a] of ANCHORS) {
    const first = text.indexOf(a);
    if (first === -1) { console.error(`🔴 çapa bulunamadı: ${a}`); process.exit(1); }
    if (text.indexOf(a, first + 1) !== -1) { console.error(`🔴 çapa birden çok kez geçiyor: ${a}`); process.exit(1); }
    pos[name] = first;
  }
  if (!(pos.toast < pos.landing && pos.landing < pos.shell && pos.shell < pos.boot)) {
    console.error('🔴 çapa sırası bozuk (toast < landing < shell < boot olmalı)'); process.exit(1);
  }
  const headEnd = pos.toast + '<div id="toastWrap"></div>'.length + 1; // +1: sonraki \n
  return {
    'head.html':    text.slice(0, headEnd),
    'landing.html': text.slice(pos.landing, pos.shell),
    'shell.html':   text.slice(pos.shell, pos.boot),
    'boot.html':    text.slice(pos.boot),
  };
}

if (mode === 'split') {
  const parts = splitIndex(readFileSync(INDEX, 'utf8'));
  for (const [f, body] of Object.entries(parts)) {
    writeFileSync(join(PDIR, f), body);
    console.log(`✂️  partials/${f} yazıldı (${body.length} B)`);
  }
  const rebuilt = assemble();
  const disk = readFileSync(INDEX, 'utf8');
  if (refreshHashes(disk) !== rebuilt) {
    console.error('🔴 split→assemble turu bayt-birebir değil!'); process.exit(1);
  }
  console.log('✅ split→assemble turu bayt-birebir doğrulandı.');
} else if (mode === 'write') {
  const out = assemble();
  writeFileSync(INDEX, out);
  console.log(`✅ index.html partials'tan üretildi (${out.length} B, ?v= hash'leri tazelendi).`);
} else {
  const out = assemble();
  const disk = existsSync(INDEX) ? readFileSync(INDEX, 'utf8') : '';
  if (out !== disk) {
    console.error('🔴 index.html, partials/ + güncel hash\'lerden üretilmiş hâlle AYNI DEĞİL.');
    console.error('   Düzeltme:  npm run build   (üretir)  — sonra index.html\'i de commit\'le.');
    console.error('   index.html\'i elle mi düzenledin?  node scripts/build-index.mjs --split');
    process.exit(1);
  }
  console.log('✅ index.html == partials birleşimi (bayt-birebir).');
}
