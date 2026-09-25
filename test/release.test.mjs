/* release.test.mjs — SÜRÜM TUTARLILIĞI + ZENODO KÜNYE KİLİDİ (2026-09-24)
 *
 * Neden: sürüm numarası YEDİ ayrı yerde geçiyor (package.json, manifest.json,
 * CITATION.cff, JSON-LD softwareVersion, landing footer, SECURITY.md, künye).
 * Biri unutulursa:
 *   · Zenodo yanlış sürüm/tarihle arşivler (atıflar karışır),
 *   · SECURITY.md desteklenmeyen sürümü "current" gösterir,
 *   · footer ile package.json çelişir (kullanıcı hangi sürümde olduğunu bilemez).
 * Hiçbiri çökme üretmediği için gözden kaçar — bu dosya o yüzden var.
 *
 * Ayrıca CITATION.cff'in Zenodo'nun beklediği alanları içerdiği ve
 * CHANGELOG'da o sürümün kaydı olduğu doğrulanır.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

const pkg = JSON.parse(rd('package.json'));
const manifest = JSON.parse(rd('manifest.json'));
const cff = rd('CITATION.cff');
const changelog = rd('CHANGELOG.md');
const head = rd('partials/head.html');
const landing = rd('partials/landing.html');
const security = rd('SECURITY.md');
const kunye = rd('kunye/index.html');

const SURUM = pkg.version;                       // örn. 12.0.0
const KISA = SURUM.split('.').slice(0, 2).join('.');  // örn. 12.0
const MAJOR = SURUM.split('.')[0];

const ld = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const app = ld['@graph'].find((n) => n['@type'] === 'WebApplication');
const ds = ld['@graph'].find((n) => n['@type'] === 'Dataset');

describe('sürüm numarası yedi yerde de aynı', () => {
  test('package.json üç parçalı SemVer', () => {
    assert.match(SURUM, /^\d+\.\d+\.\d+$/);
  });

  test('manifest.json (PWA) aynı sürüm', () => {
    assert.equal(manifest.version, SURUM);
  });

  test('CITATION.cff aynı sürüm + yayın tarihi var', () => {
    assert.match(cff, new RegExp('^version: "' + SURUM.replace(/\./g, '\\.') + '"$', 'm'));
    assert.match(cff, /^date-released: "\d{4}-\d{2}-\d{2}"$/m);
  });

  test('JSON-LD softwareVersion + Dataset version aynı', () => {
    assert.equal(app.softwareVersion, KISA);
    assert.equal(ds.version, SURUM);
  });

  test('landing footer ve künye sayfası aynı sürümü gösteriyor', () => {
    assert.match(landing, new RegExp('v' + KISA.replace('.', '\\.') + ' ·'));
    assert.match(kunye, new RegExp('v' + KISA.replace('.', '\\.') + ' \\(arayüz\\)'));
  });

  test('SECURITY.md bu sürümü "Current" olarak listeliyor', () => {
    assert.match(security, new RegExp('\\| ' + MAJOR + '\\.0\\.x\\s+\\| ✅ Current'));
  });

  test('CHANGELOG.md bu sürüm için kayıt içeriyor', () => {
    assert.match(changelog, new RegExp('## \\[' + SURUM.replace(/\./g, '\\.') + '\\] — \\d{4}-\\d{2}-\\d{2}'));
    assert.match(changelog, /### Eklendi/);
    assert.match(changelog, /### Düzeltildi/);
  });
});

describe('CITATION.cff — Zenodo künyesi', () => {
  test('zorunlu alanlar present', () => {
    for (const alan of ['cff-version: 1.2.0', 'message:', 'title:', 'type: software',
      'authors:', 'repository-code:', 'url:', 'doi:', 'license:', 'version:',
      'date-released:', 'keywords:']) {
      assert.ok(cff.includes(alan), 'eksik alan: ' + alan);
    }
  });

  test('⭐ kavram DOI ve lisans diğer kaynaklarla tutarlı', () => {
    assert.match(cff, /^doi: "10\.5281\/zenodo\.22948643"$/m);
    assert.match(cff, /^license: CC-BY-NC-4\.0$/m);
    assert.equal(pkg.license, 'CC-BY-NC-4.0');
    assert.equal(ds.license, 'https://creativecommons.org/licenses/by-nc/4.0/');
    assert.equal(ds.identifier, 'https://doi.org/10.5281/zenodo.22948643');
  });

  test('iki yazar da var (ŞİRİN, Nagihan + Sinan)', () => {
    /* Yalnız üst düzey authors bloğu sayılır — references içindeki makale
     * yazarları (Chave, Réjou-Méchain, Tolunay) da given-names kullanıyor. */
    const blogu = cff.slice(cff.indexOf('authors:'), cff.indexOf('references:'));
    const yazarlar = blogu.match(/given-names: "([^"]+)"/g) || [];
    assert.equal(yazarlar.length, 2, yazarlar.join(' | '));
    assert.equal((blogu.match(/family-names: "ŞİRİN"/g) || []).length, 2);
    assert.match(cff, /given-names: "Nagihan"/);
    assert.match(cff, /given-names: "Sinan"/);
  });

  test('ORCID için yer ayrılmış (doldurulmayı bekliyor)', () => {
    assert.ok((cff.match(/#\s*orcid:/g) || []).length >= 1, 'orcid yorum satırı yok');
  });

  test('⭐ künyede kişisel e-posta YOK', () => {
    const kisisel = new RegExp('@' + ['gmail', 'hotmail', 'outlook', 'yahoo'].join('|@') + '\\.', 'i');
    assert.ok(!kisisel.test(cff), 'CITATION.cff kişisel e-posta içeriyor');
  });

  test('yöntem referansları (Chave 2014, IPCC 2006, Tolunay 2013) künyede', () => {
    assert.match(cff, /Chave/);
    assert.match(cff, /IPCC/);
    assert.match(cff, /Tolunay/);
  });

  test('özet (abstract) dolu ve park kimliğini anlatıyor', () => {
    assert.match(cff, /abstract: >-/);
    assert.match(cff, /park kimliği/i);
    assert.match(cff, /CC BY-NC 4\.0/);
  });
});

describe('yayım süreci belgelenmiş', () => {
  test('docs/surum-yayini.md var ve Zenodo adımlarını içeriyor', () => {
    const p = 'docs/surum-yayini.md';
    assert.ok(existsSync(join(ROOT, p)));
    const t = rd(p);
    assert.match(t, /zenodo\.org/i);
    assert.match(t, /Draft a new release|Releases/);
    assert.match(t, /kavram DOI|concept DOI/i);
    assert.match(t, /CHANGELOG\.md/);
    assert.match(t, /test\/release\.test\.mjs|release\.test/);
  });

  test('CHANGELOG yayım rehberine bağlı', () => {
    assert.match(changelog, /docs\/surum-yayini\.md/);
  });

  test('README atıf bloğu iki yazarı ve lisansı içeriyor', () => {
    const r = rd('README.md');
    assert.match(r, /\\c\{S\}irin, Nagihan and \\c\{S\}irin, Sinan/);
    assert.match(r, /license\s*=\s*\{CC-BY-NC-4\.0\}/);
    assert.match(r, /10\.5281\/zenodo\.22948643/);
  });

  test('LICENSE + NOTICE mevcut ve CC BY-NC 4.0', () => {
    assert.match(rd('LICENSE'), /Attribution-NonCommercial 4\.0 International/);
    assert.match(rd('NOTICE'), /CC BY-NC 4\.0/);
    assert.match(rd('NOTICE'), /10\.5281\/zenodo\.22948643/);
  });
});

/* =========================================================
   SATIR SONU NORMALİZASYONU
   Canlı vaka (2026-09-24): manifest.json CRLF ile commit edilmişti, yama
   aktarılırken LF'ye döndü ve `git am --3way` şu hatayı verdi:
     error: patch failed: manifest.json:1
     error: Did you hand edit your patch?
   Çözüm .gitattributes (birinci taraf metin = LF, vendor hariç). Bu test
   normalizasyonun bozulmasını engeller — yoksa aynı hata geri gelir.
========================================================= */
describe('satır sonu normalizasyonu (yama taşınabilirliği)', () => {
  test('.gitattributes birinci tarafı LF\'e sabitliyor, vendor\'ı hariç tutuyor', () => {
    const ga = rd('.gitattributes');
    assert.match(ga, /\* text=auto eol=lf/);
    assert.match(ga, /vendor\/\*\* -text/, 'vendor baytlarına dokunulmamalı (hash/PRECACHE bozulmasın)');
    assert.match(ga, /\*\.png binary/);
  });

  test('⭐ birinci taraf metin dosyalarında CRLF yok', () => {
    const IKILI = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|eot|pdf|zip|mp3)$/i;
    const dosyalar = [];
    const yuru = (d) => {
      for (const a of readdirSync(d)) {
        if (a === '.git' || a === 'node_modules' || a === 'vendor' || a.startsWith('.')) continue;
        const t = join(d, a);
        if (statSync(t).isDirectory()) yuru(t);
        else if (!IKILI.test(a)) dosyalar.push(t);
      }
    };
    yuru(ROOT);
    assert.ok(dosyalar.length > 30, 'tarama dosya bulamadı: ' + dosyalar.length);
    const crlf = dosyalar.filter((f) => {
      try { return readFileSync(f).includes(Buffer.from('\r\n')); } catch (e) { return false; }
    }).map((f) => f.slice(ROOT.length + 1));
    assert.deepEqual(crlf, [], 'CRLF içeren dosyalar (yamalar bozulur): ' + crlf.join(', '));
  });

  test('vendor dosyalarına DOKUNULMADI (leaflet CSS hâlâ CRLF olabilir)', () => {
    const v = readFileSync(join(ROOT, 'vendor/leaflet-1.9.4.css'));
    assert.ok(v.includes(Buffer.from('\r\n')), 'vendor içeriği değişmiş — .gitattributes kapsamı yanlış');
  });
});
