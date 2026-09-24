#!/usr/bin/env node
/* check-csp.mjs — index.html'deki CSP ile kodda kullanılan origin'leri karşılaştırır.
 *
 * Neden gerekli: CSP tek direktifli (default-src) olduğu için, koda yeni bir dış
 * servis eklendiğinde CSP güncellenmezse istek tarayıcı tarafından SESSİZCE kesilir.
 * Bu betik o hata sınıfını CI'da yakalar.
 *
 * Kullanım:  node scripts/check-csp.mjs
 * Çıkış kodu: 0 = tutarlı, 1 = eksik origin var
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/* Sadece bağlantı/kaynak olarak yüklenen origin'ler denetlenir.
 * Aşağıdakiler yalnızca <a href>, canonical, og:url veya XML ad alanı olarak geçer;
 * CSP ile ilgileri yoktur. */
const BEYAZ_LISTE = new Set([
  'dendrogeo.org',          // canonical / og:url
  'www.dendrogeo.org',
  'doi.org',                // atıf bağlantısı
  'zenodo.org',             // DOI rozeti
  'creativecommons.org',    // lisans bağlantısı
  'opendatacommons.org',    // ODbL lisans bağlantısı (JSON-LD isBasedOn + atıf metni)
  'schema.org',             // JSON-LD @context (ağ isteği üretmez)
  'www.w3.org',             // XML ad alanları (sitemap, SVG)
  'github.com',
  'img.shields.io',
  /* Leaflet attribution kontrolündeki <a href> hedefleri (2026-09-24):
   * ODbL/CC-BY-SA atfı bağlantı vermek ZORUNDA, ama bu origin'lerden hiçbir
   * kaynak yüklenmiyor (karolar *.tile.openstreetmap.org ve
   * *.tile.opentopomap.org üzerinden gelir, ikisi de CSP'de tanımlı). */
  'www.openstreetmap.org',
  'opentopomap.org',
]);

function* kodDosyalari() {
  yield 'index.html';
  yield 'sw.js';
  /* vendor/ BİLEREK TARANMIYOR.
   * Üçüncü taraf paketlerin kaynak metninde belgeleme amaçlı URL'ler bulunur
   * (ör. leaflet.js başlığındaki "https://leafletjs.com", supabase-js içindeki
   * "https://www.jsdelivr.com/using-sri-with-dynamic-files" notu). Bunlar istek
   * üretmez ama desen eşleştirmesi onları gerçek origin sanıp yanlış pozitif
   * verir — bu betiğin ilk sürümünde tam olarak bu yaşandı.
   *
   * vendor dosyalarının GERÇEK ağ hedefleri çağıranın verdiği URL'lerdir
   * (supabase-js → *.supabase.co, geotiff → Planetary Computer blob adresi) ve
   * o origin'ler zaten src/ tarafındaki kullanımdan yakalanıp CSP'ye ekleniyor.
   * vendor/ sözdizimi denetimine (check-syntax.mjs) tabi tutulmaya devam ediyor. */
  for (const dir of ['src/services', 'src/config', 'src/utils']) {
    const tam = join(ROOT, dir);
    if (!statSync(tam).isDirectory()) continue;
    for (const f of readdirSync(tam)) if (f.endsWith('.js')) yield join(dir, f);
  }
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const eslesme = html.match(/Content-Security-Policy"\s+content="([^"]+)"/);
if (!eslesme) {
  console.error('🔴 index.html içinde CSP meta etiketi bulunamadı.');
  process.exit(1);
}
const csp = eslesme[1];

/* CSP'de izin verilen ana bilgisayar adları */
const izinli = new Set(
  csp.split(/[\s;]+/).filter((t) => /^https?:\/\//.test(t)).map((t) => t.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
);
const wildcards = [...izinli].filter((x) => x.startsWith('*.'));

function izinliMi(host) {
  if (izinli.has(host)) return true;
  return wildcards.some((w) => host.endsWith(w.slice(1))); // '*.x.com' → '.x.com'
}

/* Kodda geçen tüm https ana bilgisayar adları */
const bulunanlar = new Map(); // host → [dosya:satır]
for (const dosya of kodDosyalari()) {
  const icerik = readFileSync(join(ROOT, dosya), 'utf8');
  icerik.split('\n').forEach((satir, i) => {
    for (const m of satir.matchAll(/https:\/\/([a-zA-Z0-9.-]+)/g)) {
      const host = m[1].toLowerCase();
      if (!bulunanlar.has(host)) bulunanlar.set(host, []);
      bulunanlar.get(host).push(`${dosya}:${i + 1}`);
    }
  });
}

const eksik = [];
for (const [host, yerler] of [...bulunanlar.entries()].sort()) {
  if (BEYAZ_LISTE.has(host) || izinliMi(host)) continue;
  eksik.push({ host, yerler });
}

if (eksik.length) {
  console.error(`🔴 CSP'de eksik origin var (${eksik.length}). Bu istekler tarayıcı tarafından kesilir:\n`);
  for (const { host, yerler } of eksik) {
    console.error(`   https://${host}`);
    for (const y of yerler.slice(0, 4)) console.error(`      └─ ${y}`);
    if (yerler.length > 4) console.error(`      └─ … +${yerler.length - 4} yer daha`);
  }
  console.error(`\nCSP (${eksik.length ? 'default-src' : ''}) içinde bulunmadığı için connect-src/img-src bu origin'lere düşer ve istek engellenir.`);
  console.error('Düzeltme: index.html CSP listesine bu origin\'leri ekleyin.\n');
  process.exit(1);
}

console.log(`✅ CSP tutarlı — ${bulunanlar.size} origin denetlendi, ${izinli.size} izin tanımlı.`);
const kullanilmayan = [...izinli].filter(
  (x) => !x.startsWith('*.') && !bulunanlar.has(x) && !BEYAZ_LISTE.has(x)
);
if (kullanilmayan.length) {
  console.log(`ℹ️  Kodda geçmeyen ama izin verilen origin'ler (daraltılabilir): ${kullanilmayan.join(', ')}`);
}
