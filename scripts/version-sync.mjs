#!/usr/bin/env node
/* version-sync.mjs — ?v= sürüm numaralarını İÇERİK HASH'inden türetir.
 *
 * Sorun
 * -----
 * index.html her dosyayı "?v=NNN" ile yüklüyor ve bu numaralar ELLE
 * artırılıyordu. gridplan.js ?v=139'a ulaşmıştı. İnsan eliyle yapılan bu iş:
 *   · unutulabiliyor (dosya değişir ama numara artmaz → kullanıcı bayat kod görür)
 *   · gereksiz artırılabiliyor (dosya değişmedi ama numara arttı → herkes yeniden indirir)
 *   · repo ile canlı siteyi ayrıştırabiliyordu (?v=90 vs ?v=84, ?v=97 vs ?v=96)
 *
 * Çözüm
 * -----
 * ?v= değeri artık dosyanın sha256'sının ilk 8 karakteri. İçerik değişmedikçe
 * numara değişmez; içerik değişince OTOMATİK değişir. Unutmak imkânsız.
 *
 *   node scripts/version-sync.mjs --check   → uyumsuzsa exit 1 (CI için)
 *   node scripts/version-sync.mjs --write   → index.html'i günceller
 *
 * Not: sw.js r32'den beri uygulama JS/CSS'i network-first yüklüyor, yani ?v=
 * artık ZORUNLU değil; yalnızca HTTP önbelleğini deterministik kırmak için
 * kullanılıyor. Bu betik o işi otomatikleştiriyor.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = process.argv.includes('--write') ? 'write'
          : process.argv.includes('--check') ? 'check'
          : 'check';

const htmlYol = join(ROOT, 'index.html');
let html = readFileSync(htmlYol, 'utf8');

const v8 = (p) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex').slice(0, 8);

let degisen = 0, sorun = 0;
html = html.replace(/((?:src|href)=")((?:src|css|vendor)\/[^"?]+)(\?v=)([A-Za-z0-9]+)(")/g,
  (tum, on, yol, soru, eski, son) => {
    let beklenen;
    try { beklenen = v8(yol); }
    catch { console.error(`🔴 index.html kayıp dosyaya işaret ediyor: ${yol}`); sorun++; return tum; }
    if (eski === beklenen) return tum;
    degisen++;
    console.log(`${mod === 'write' ? '✏️ ' : '🔴 '}${yol}  ?v=${eski} → ?v=${beklenen}`);
    return on + yol + soru + beklenen + son;
  });

if (sorun) process.exit(1);

if (mod === 'write') {
  if (degisen) {
    writeFileSync(htmlYol, html);
    console.log(`\n✅ ${degisen} sürüm numarası içerik hash'iyle güncellendi.`);
  } else {
    console.log('✅ Tüm ?v= numaraları içerikle tutarlı.');
  }
} else if (degisen) {
  console.error(`\n🔴 ${degisen} dosyanın ?v= numarası içerikle uyumsuz.`);
  console.error('   Düzeltmek için: node scripts/version-sync.mjs --write');
  process.exit(1);
} else {
  console.log('✅ Tüm ?v= numaraları içerikle tutarlı.');
}
