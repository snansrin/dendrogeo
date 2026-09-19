#!/usr/bin/env node
/* check-syntax.mjs — tüm JS dosyalarını TARAYICI semantiğiyle ayrıştırır.
 *
 * Neden `node --check` değil?
 *   `node --check` .js dosyalarını CommonJS modül kabul eder. Bu dosyalar ise
 *   <script src> ile yüklenen klasik script'ler: global kapsam + sloppy mode.
 *   Fark somut olarak ortaya çıkıyor — gridplan.js "use strict" ile başlıyor ve
 *   sloppy modda yasal olan yinelenen üst-düzey `function` bildirimleri
 *   CommonJS yorumunda "already declared" hatası veriyordu. Yani `node --check`
 *   canlıda sorunsuz çalışan bir dosya için yanlış pozitif üretiyordu.
 *
 *   vm.Script kaynak metni bir script olarak (sloppy mode, global kapsam)
 *   ayrıştırır — tarayıcının <script src> için yaptığı şey tam olarak budur.
 *
 * Kullanım: node scripts/check-syntax.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function* yuru(dizin) {
  for (const ad of readdirSync(dizin)) {
    if (ad === 'node_modules' || ad.startsWith('.')) continue;
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) yield* yuru(tam);
    else if (ad.endsWith('.js')) yield tam;
  }
}

const dosyalar = [join(ROOT, 'sw.js')];
for (const d of ['src', 'scripts']) {
  const tam = join(ROOT, d);
  if (statSync(tam).isDirectory()) dosyalar.push(...yuru(tam));
}

let kotu = 0;
for (const f of dosyalar) {
  const göreli = f.slice(ROOT.length + 1);
  try {
    new vm.Script(readFileSync(f, 'utf8'), { filename: göreli });
  } catch (e) {
    console.error(`🔴 ${göreli}:${e.stack?.match(/:(\d+)\n/)?.[1] ?? '?'} → ${e.message}`);
    kotu++;
  }
}

/* index.html içindeki satır içi script'ler de aynı biçimde denetlenir. */
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const bloklar = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
bloklar.forEach((m, i) => {
  try {
    new vm.Script(m[1], { filename: `index.html#inline${i + 1}` });
  } catch (e) {
    console.error(`🔴 index.html satır içi script #${i + 1} → ${e.message}`);
    kotu++;
  }
});

if (kotu) {
  console.error(`\n${kotu} dosya/blok ayrıştırılamadı.`);
  process.exit(1);
}
console.log(`✅ ${dosyalar.length} JS dosyası + ${bloklar.length} satır içi script tarayıcı semantiğiyle geçerli.`);
