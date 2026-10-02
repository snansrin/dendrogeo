/* photo-qa.test.mjs — 0044 · ÇOK SINIFLI FOTOĞRAF DENETİMİ BEKÇİLERİ
 *
 * KULLANICI (0044): "%25'i kırmızı yapraklı ağaçlar sağlamıyor ve önümüz kış,
 * fotoğrafta sadece dal olacağı için yeşil çok az — o yüzden fotoğraf
 * yükleyemez kullanıcılar. Ben bugün 1 fotoğraf için sahada 30 dk harcadım."
 *
 * KÖK NEDEN (kanıt: calib/ korpusu, 22 gerçek kare): eski kapı YALNIZ yeşil
 * pikseli sayıyordu → mor/kırmızı yaprak %12, kış çıplak dal %0.4 yeşil →
 * KAYIT ENGELLİ. Üstelik saf gökyüzü %52 "yeşil" sayılıp GEÇİYORDU (ExG'de
 * G>B koruması yoktu).
 *
 * ÇÖZÜM: piksel başına çok sınıflı sınıflandırma (yeşil · kızıl/mor ·
 * sonbahar · gövde/dal · kış kadrajı) + parlaklık-modu sapmasıyla ince yapı.
 * dgPhotoScan SAF fonksiyondur → burada tarayıcı/canvas OLMADAN, sentetik
 * karelerle davranışı ölçülür.
 *
 * KIRMIZI ÇİZGİ: bu kapı ölçüm bilimine DOKUNMAZ (QA_LIMITS, karbon motoru,
 * şema/RLS değişmez); karar hâlâ insanda — kapı yalnız BARİZ yanlış kareyi
 * (gök/duvar/kapak/patlak) sahada erken yakalar, onay akışı esas kalite
 * kapısıdır (yönetim tablosu fotoğrafı gösterir).
 *
 * Ayrıca: harici model soketi + 🤖 yönetim kartı KULLANICI KARARIYLA kökten
 * silindi → "iz kalmasın" bekçileri burada tersine kilitlidir. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const meas = rd('src/services/measure.js');

/* measure.js'i İZOLE bağlamda yükle (DOM/ağ yok; yalnız saf tarayıcı). */
function yukle() {
  const stub = new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => '' : stub),
    apply: () => stub, construct: () => stub, set: () => true,
  });
  const ctx = {
    window: stub, document: stub, navigator: stub,
    localStorage: { getItem: () => null, setItem() {} },
    console: { log() {}, warn() {}, error() {} },
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(meas + ';this.__scan=dgPhotoScan;this.__gate=dgPhotoGate;this.__label=dgPhotoLabel;', ctx);
  return ctx;
}

/* Sentetik kare üretici: RGBA dizisi (canvas getImageData taklidi). */
function kare(S, fn) {
  const d = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [R, G, B] = fn(x, y);
    const p = (y * S + x) * 4;
    d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
  }
  return d;
}
const S = 64;
const duz = (c) => kare(S, () => c);
const gurultu = (c, a) => kare(S, (x, y) => {
  const k = ((x * 7 + y * 13) % 5) - 2;           /* deterministik ±2 */
  return [c[0] + k * a, c[1] + k * a, c[2] + k * a];
});

describe('0044 · çok sınıflı fotoğraf denetimi (davranış · vm)', () => {
  const { __scan: scan, __gate: gate, __label: label } = yukle();

  test('⭐ yeşil örtü geçer (kontrol vakası bozulmadı)', () => {
    const m = scan(gurultu([60, 120, 50], 1), S);
    assert.ok(m.green > 0.9, 'yeşil oranı: ' + m.green);
    assert.equal(gate(m), true);
  });

  test('⭐ KIRMIZI/MOR YAPRAK geçer — kullanıcının 1. vakası (eski kapıda engelliydi)', () => {
    const d = gurultu([110, 50, 80], 1);           /* antosiyanin: Prunus pissardii */
    const m = scan(d, S);
    assert.ok(m.purple > 0.9, 'mor oranı: ' + m.purple);
    /* ESKİ formül bu karede ~%0 yeşil bulurdu → kayıt engellenirdi. Kanıt: */
    let eskiVeg = 0;
    for (let p = 0; p < d.length; p += 4) if (2 * d[p + 1] - d[p] - d[p + 2] > 20 && d[p + 1] > 50) eskiVeg++;
    assert.ok(eskiVeg / (S * S) < 0.25, 'eski kapı bu kareyi engellerdi (yeşil <%25)');
    assert.equal(gate(m), true, 'yeni kapı mor yaprağı kabul etmeli');
  });

  test('⭐ SONBAHAR sarı/turuncu geçer', () => {
    const m = scan(gurultu([200, 140, 40], 1), S);
    assert.ok(m.warm > 0.9, 'sıcak oranı: ' + m.warm);
    assert.equal(gate(m), true);
  });

  test('⭐ GÖVDE/kabuk kadrajı geçer (DBH şerit metre sahnesi)', () => {
    const m = scan(gurultu([120, 90, 60], 1), S);
    assert.ok(m.woody > 0.9, 'kabuk oranı: ' + m.woody);
    assert.equal(gate(m), true);
  });

  test('⭐ KIŞ ÇIPLAK DAL geçer — kullanıcının 2. vakası (mavi gök + dal silüeti)', () => {
    const d = kare(S, (x, y) => (x % 8 < 2 ? [45, 42, 40] : [50, 110, 180]));
    const m = scan(d, S);
    assert.ok(m.blue >= 0.25, 'gök mavisi fon: ' + m.blue);
    assert.ok(m.struct >= 0.025 || m.dark >= 0.03, 'dal silueti: ' + m.struct + '/' + m.dark);
    assert.equal(gate(m), true, 'kış kadrajı kabul edilmeli');
    assert.match(label(m), /kış kadrajı/, 'kullanıcıya ne gördüğümüz söylenir');
  });

  test('⭐ SAF GÖKYÜZÜ reddedilir — eski kapının GEÇİRDİĞİ sahte pozitif artık kapalı', () => {
    const m = scan(gurultu([60, 130, 200], 1), S);
    assert.ok(m.green === 0, 'mavi gök yeşile SIZAMAZ (G>=B-2 koruması): ' + m.green);
    assert.equal(gate(m), false);
  });

  test('⭐ düz/g dokulu DUVAR reddedilir (ince yapı eşiği mavi fon şartına bağlı)', () => {
    const d = kare(S, (x, y) => (x % 16 < 2 || y % 16 < 2 ? [125, 125, 123] : [150, 150, 148]));
    const m = scan(d, S);
    assert.equal(gate(m), false, 'duvar dokusu ağaç kanıtı sayılmamalı');
  });

  test('⭐ pozlama teknik kapısı korunur: kapak (siyah) ve patlak (beyaz) reddedilir', () => {
    assert.equal(gate(scan(duz([5, 5, 6]), S)), false, 'çok karanlık');
    assert.equal(gate(scan(duz([250, 250, 248]), S)), false, 'patlak');
  });

  test('etiket dizeleri kullanıcıya sınıfı söyler (boş uyarı yok)', () => {
    assert.match(label(scan(gurultu([60, 120, 50], 1), S)), /yeşil örtü/);
    assert.match(label(scan(gurultu([110, 50, 80], 1), S)), /kızıl\/mor yaprak/);
  });
});

describe('0044 · statik kilitler', () => {
  test('⭐ eski yeşil-tek kapı GERİ GELMEZ (kök neden kilitli)', () => {
    assert.ok(!/2\*G-R-B>20&&G>50/.test(meas), 'eski yeşil-tek formülü');
    assert.ok(!/vegR>=0\.25/.test(meas), 'eski %25 sabit kapısı');
    assert.match(meas, /G>=B-2/, 'mavi gök sızmasını kesen koruma');
    assert.match(meas, /function dgPhotoScan/, 'saf tarayıcı');
    assert.match(meas, /function dgPhotoGate/, 'kalibre kapı');
  });

  test('⭐ kaydetme kapısı DURUYOR (photoOk sözleşmesi bozulmadı)', () => {
    assert.match(meas, /photoOk=ok/, 'kapı durumu hesaplanır');
    assert.match(meas, /if\(f&&!photoOk\)/, 'saveMeas teknik kapıyı uygular');
  });

  test('⭐ harici model soketi + 🤖 kart: HİÇBİR İZ KALMADI (kullanıcı kararı)', () => {
    assert.ok(!existsSync(join(ROOT, 'src/services/species-ai.js')), 'modül dosyası');
    const idx = rd('index.html');
    assert.ok(!idx.includes('species-ai'), 'index.html');
    assert.ok(!idx.includes('aiSuggest'), 'index: sonuç kutusu');
    assert.ok(!idx.includes('AI Ağaç Algılama'), 'index: kart başlığı');
    const sw = rd('sw.js');
    assert.ok(!sw.includes('species-ai'), 'sw CORE_ASSETS');
    assert.ok(!rd('partials/shell.html').includes('dgAiAdmin'), 'shell: kart kutusu');
    assert.ok(!rd('src/services/admin.js').includes('dgAiAdminRender'), 'admin: çağrı');
    assert.ok(!meas.includes('dgAiOnPhoto'), 'measure: kanca');
    const i18n = rd('src/config/i18n.js');
    assert.ok(!i18n.includes('AI Ağaç Algılama'), 'i18n: kart başlığı');
    assert.ok(!i18n.includes('yerleşik algılayıcı'), 'i18n: yerleşik algılayıcı');
    assert.ok(!i18n.includes('uç nokta'), 'i18n: uç nokta/CORS metni');
  });

  test('⭐ fotoğraf denetimi TEK YERDE: Yeni Ölçüm sekmesi, fotoğraf düğmesi', () => {
    const sh = rd('partials/shell.html');
    assert.match(sh, /onchange="checkPhoto\(event\)"/, 'düğme kancası');
    assert.match(sh, /id="photoCheck"/, 'sonuç kutusu formda');
    const a = sh.indexOf('id="photoCheck"'), b = sh.indexOf('id="v-nav"');
    assert.ok(a > 0 && a < b, 'kutu ölçüm görünümünde (nav\'dan önce)');
  });

  test('⭐ yeni kullanıcı dizeleri EN sözlüğünde (i18n sözleşmesi)', () => {
    const i18n = rd('src/config/i18n.js');
    for (const s of ['yeşil örtü', 'kızıl/mor yaprak', 'sonbahar rengi', 'gövde/dal',
      'kış kadrajı (dal silüeti)', 'bitki/dal kanıtı yeterli', 'Fotoğraf denetleniyor…',
      'Yalnızca görsel dosyası yükleyin.',
      'Karede ağaç/dal/bitki örtüsü kanıtı bulunamadı.',
      'Pozlama uygun değil (çok karanlık veya patlak).',
      'Ağacı, gövdesini veya dallarını kadraja alıp yeniden çekin.'])
      assert.ok(i18n.includes(JSON.stringify(s) + ':'), 'eksik EN girdisi: ' + s);
  });

  test('⭐ landing iddiası kodla BİREBİR (vitrin↔kod tutarlılığı)', () => {
    const claim = 'Fotoğraf eklenirse tarayıcı içi çok sınıflı denetim uygulanır: yeşil · kızıl/mor · sonbahar · gövde/dal · kış kadrajı + pozlama 25–245';
    assert.ok(rd('partials/landing.html').includes(claim), 'landing satırı güncel');
    assert.ok(rd('index.html').includes(claim), 'üretilmiş index güncel');
    assert.ok(rd('src/config/i18n.js').includes(JSON.stringify(claim) + ':'), 'EN karşılığı');
    assert.ok(!rd('partials/landing.html').includes('bitki örtüsü ≥ %25'), 'eski iddia kalktı');
  });

  test('⭐ çevrimdışı paket sözleşmesi: içerik değişti → sw r52', () => {
    assert.match(rd('sw.js'), /CACHE_VERSION = 'dendrogeo-sw-v2-r61'/);
  });
});
