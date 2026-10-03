/* lc-validate.test.mjs — DOĞRULAMA ÇALIŞMA SAHASI (v5 · 2026-10-03) KİLİTLERİ
 *
 * Bilimsel çekirdek (lc-validate.js) + Sentinel-2 sabitleri (lc-s2.js) +
 * entegrasyon zinciri (lazylibs/sw/park-panel/park-export/i18n) kilitlenir.
 *
 * METRİK REFERANSLARI ELLE HESAPLANDI (Olofsson vd. 2014, RSE 144:48-57):
 * Aşağıdaki 'REFERANS VAKA' bloğunda her sayının türetmesi yorumda durur —
 * formül değişirse test kırılır ve türetmeyle karşılaştırılır.
 *
 * KIRMIZI ÇİZGİ BEKÇİSİ: bu dosya, doğrulama katmanının sayısal analiz
 * hattına DOKUNMADIĞINI da kilitler (landcover.js/make-report değişmedi).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from '../scripts/test-harness.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const app = loadApp({ sadece: ['src/config/constants.js', 'src/utils/geo.js',
  'src/services/lc-config.js', 'src/services/lc-geo.js', 'src/services/lc-stac.js',
  'src/services/lc-engine.js', 'src/services/lc-osm.js', 'src/services/lc-patches.js',
  'src/services/lc-validate.js', 'src/services/lc-s2.js',
  'src/ui/lc-report.js', 'src/services/landcover.js'] });
const {
  dgValRng, dgValStratifiedSample, dgValConfusion, dgValWeights, dgValMetrics,
  dgValSpectralPredict, dgValAgreement, dgValGate, dgValCsv, dgValCampaignJson,
  DG_VAL_CLASSES, DG_VAL_GATE, DG_VAL_SPECTRAL,
  DG_S2_COLLECTION, DG_S2_MAX_SCENES, DG_S2_SCL_VALID, DG_S2_MIN_OBS_GUARD,
  dgS2Median, dgS2SeasonRange,
} = app;

/* ═══════════════════════ REFERANS VAKA (elle hesap) ═══════════════════════
 * Tabaka ağırlıkları (TAM SAYIM alanlarından): W_green=0.7, W_water=0.2,
 * W_hard=0.1, W_bare=0.
 * Örneklem: her tabakadan n=10.
 *   green: 8 green, 1 water, 1 hard   → p̂_gg=0.8
 *   water: 9 water, 1 green           → p̂_ww=0.9
 *   hard:  6 hard, 4 green            → p̂_hh=0.6
 *
 * OA  = 0.7·0.8 + 0.2·0.9 + 0.1·0.6 = 0.56+0.18+0.06 = 0.80
 * SE² = 0.7²·(0.8·0.2)/10 + 0.2²·(0.9·0.1)/10 + 0.1²·(0.6·0.4)/10
 *     = 0.00784 + 0.00036 + 0.00024 = 0.00844 → SE = 0.0918695…
 * CI95(OA) = 1.96·SE = 0.1800642…
 *
 * Düzeltilmiş kolon oranları p̂ⱼ = Σᵢ Wᵢ·p̂ᵢⱼ:
 *   green: 0.7·0.8 + 0.2·0.1 + 0.1·0.4 = 0.56+0.02+0.04 = 0.62
 *   water: 0.7·0.1 + 0.2·0.9 + 0.1·0.0 = 0.07+0.18      = 0.25
 *   hard:  0.7·0.1 + 0.2·0.0 + 0.1·0.6 = 0.07+0.06      = 0.13
 *   toplam = 1.00 ✓
 * pe = Σⱼ Wⱼ·p̂ⱼ = 0.7·0.62 + 0.2·0.25 + 0.1·0.13 = 0.434+0.05+0.013 = 0.497
 * κ  = (0.80−0.497)/(1−0.497) = 0.303/0.503 = 0.6023857…
 *
 * UA: green 0.8, water 0.9, hard 0.6
 * PAⱼ = Wⱼ·p̂ⱼⱼ/p̂ⱼ:
 *   green = 0.7·0.8/0.62 = 0.9032258…
 *   water = 0.2·0.9/0.25 = 0.72
 *   hard  = 0.1·0.6/0.13 = 0.4615385…
 *
 * Düzeltilmiş alan (A_tot=50000 m²):
 *   green 31000 m² (3.10 ha), water 12500 m² (1.25 ha), hard 6500 m² (0.65 ha)
 * SE(Â_water) = 50000·√(0.7²·(0.1·0.9)/9 + 0.2²·(0.9·0.1)/9 + 0.1²·0/9)
 *             = 50000·√(0.0049+0.0004+0) = 50000·√0.0053 = 3640.0549… m²
 * ═══════════════════════════════════════════════════════════════════════ */
function referansOrnekler() {
  const s = [];
  const ekle = (mapClass, refClass, n) => {
    for (let k = 0; k < n; k++) s.push({ mapClass, refClass, id: mapClass + k });
  };
  ekle('green', 'green', 8); ekle('green', 'water', 1); ekle('green', 'hard', 1);
  ekle('water', 'water', 9); ekle('water', 'green', 1);
  ekle('hard', 'hard', 6); ekle('hard', 'green', 4);
  return s;
}
const REF_W = { green: 0.7, water: 0.2, hard: 0.1, bare: 0 };
const REF_A = 50000;

describe('lc-validate · hata matrisi ve Olofsson metrikleri', () => {
  const conf = dgValConfusion(referansOrnekler());
  const m = dgValMetrics(conf, REF_W, REF_A);

  test('hata matrisi sayımları doğru (nᵢ satır toplamları)', () => {
    assert.equal(conf.nRow.green, 10);
    assert.equal(conf.nRow.water, 10);
    assert.equal(conf.nRow.hard, 10);
    assert.equal(conf.nRow.bare, 0);
    assert.equal(conf.nTotal, 30);
    assert.equal(conf.n.green.water, 1);
    assert.equal(conf.n.hard.green, 4);
  });

  test('⭐ OA elle hesapla birebir: 0.80', () => {
    assert.ok(Math.abs(m.oa - 0.80) < 1e-4, 'OA=' + m.oa);
  });
  test('⭐ SE(OA) ve CI95 elle hesapla birebir', () => {
    assert.ok(Math.abs(m.oaSe - 0.0918695) < 1e-4, 'SE=' + m.oaSe);
    assert.ok(Math.abs(m.oaCi95 - 0.1800642) < 1e-3, 'CI=' + m.oaCi95);
  });
  test('⭐ kappa elle hesapla birebir: 0.60239', () => {
    assert.ok(Math.abs(m.kappa - 0.6023857) < 1e-4, 'κ=' + m.kappa);
    assert.ok(Math.abs(m.pe - 0.497) < 1e-6, 'pe=' + m.pe);
  });
  test('⭐ UA/PA sınıf bazında elle hesapla birebir', () => {
    assert.ok(Math.abs(m.perClass.green.ua - 0.8) < 1e-9);
    assert.ok(Math.abs(m.perClass.water.ua - 0.9) < 1e-9);
    assert.ok(Math.abs(m.perClass.hard.ua - 0.6) < 1e-9);
    assert.ok(Math.abs(m.perClass.green.pa - 0.9032258) < 1e-4);
    assert.ok(Math.abs(m.perClass.water.pa - 0.72) < 1e-9);
    assert.ok(Math.abs(m.perClass.hard.pa - 0.4615385) < 1e-4);
  });
  test('⭐ alan düzeltmeli hektarlar + SE elle hesapla birebir', () => {
    assert.ok(Math.abs(m.adjusted.green.areaM2 - 31000) < 1, m.adjusted.green.areaM2);
    assert.ok(Math.abs(m.adjusted.water.areaM2 - 12500) < 1);
    assert.ok(Math.abs(m.adjusted.hard.areaM2 - 6500) < 1);
    assert.ok(Math.abs(m.adjusted.water.seM2 - 3640.0549) < 1, 'SE=' + m.adjusted.water.seM2);
    const toplam = m.adjusted.green.areaM2 + m.adjusted.water.areaM2 + m.adjusted.hard.areaM2 + m.adjusted.bare.areaM2;
    assert.ok(Math.abs(toplam - REF_A) < 2, 'düzeltilmiş alanlar A_tot’u kapatmalı: ' + toplam);
  });
  test('düzeltilmiş oranlar 1’e tamamlanır', () => {
    const p = ['green', 'water', 'hard', 'bare'].reduce((a, k) => a + m.adjusted[k].proportion, 0);
    assert.ok(Math.abs(p - 1) < 1e-6, 'Σp̂ⱼ=' + p);
  });
  test('kararsız etiket paydada kalır, paya girmez (muhafazakâr OA)', () => {
    const s = referansOrnekler();
    s.push({ mapClass: 'green', refClass: 'ambiguous', id: 'amb1' });
    const c2 = dgValConfusion(s);
    assert.equal(c2.nRow.green, 11);           /* payda büyüdü */
    assert.equal(c2.nAmbiguous, 1);
    const m2 = dgValMetrics(c2, { green: 0.7, water: 0.2, hard: 0.1, bare: 0 }, REF_A);
    assert.ok(m2.oa < m.oa, 'kararsız eklenince OA düşmeli (0.8·10/11 ağırlığı)');
  });
  test('boş/eksetiketli örnekler matrise girmez', () => {
    const c3 = dgValConfusion([{ mapClass: 'green' }, null, { refClass: 'water' }]);
    assert.equal(c3.nTotal, 0);
  });
});

describe('lc-validate · tabaka ağırlıkları (tam sayım)', () => {
  test('ağırlıklar alan oranlarından gelir, 4 sınıfa normalize edilir', () => {
    const W = dgValWeights({ green: 700, water: 200, hard: 100, bare: 0, other: 50 }, 1050);
    /* other hariç toplam 1000 içinde: 0.7/0.2/0.1/0 */
    assert.ok(Math.abs(W.green - 0.7) < 1e-9);
    assert.ok(Math.abs(W.water - 0.2) < 1e-9);
    assert.ok(Math.abs(W.hard - 0.1) < 1e-9);
    assert.equal(W.bare, 0);
  });
  test('sıfır alan → ağırlıklar 0 (NaN yayılmaz)', () => {
    const W = dgValWeights({}, 0);
    for (const c of DG_VAL_CLASSES) assert.equal(W[c], 0);
  });
});

describe('lc-validate · tabakalı örnekleme (Olofsson tasarımı)', () => {
  /* 40 yeşil + 8 su + 5 sert hücre; her hücre 100 m² tam, quadWgs ~0.0001° */
  function hucreler() {
    const cells = [];
    const mk = (row, col, classKey, classCode, areaM2) => {
      const lat = 40 + row * 0.0001, lon = 32 + col * 0.00012;
      cells.push({
        row, col, classKey, classCode, areaM2,
        center: { lat, lon },
        quadWgs: [[lon, lat], [lon + 0.00012, lat], [lon + 0.00012, lat + 0.0001], [lon, lat + 0.0001]],
      });
    };
    let r = 0;
    for (let i = 0; i < 40; i++) mk(r, i % 10, 'green', 10 + (i % 3) * 10, 100), r += (i % 10 === 9 ? 1 : 0);
    for (let i = 0; i < 8; i++) mk(50 + i, 20, 'water', 80, 100);
    for (let i = 0; i < 5; i++) mk(60 + i, 30, 'hard', 50, 100);
    return cells;
  }

  test('⭐ deterministik: aynı tohum → aynı noktalar (tekrar üretilebilirlik)', () => {
    const a = dgValStratifiedSample(hucreler(), { perStratum: 5, seed: 42 });
    const b = dgValStratifiedSample(hucreler(), { perStratum: 5, seed: 42 });
    assert.deepEqual(a, b);
  });
  test('farklı tohum → farklı seçim', () => {
    const a = dgValStratifiedSample(hucreler(), { perStratum: 5, seed: 42 });
    const b = dgValStratifiedSample(hucreler(), { perStratum: 5, seed: 43 });
    assert.notDeepEqual(a.map(p => p.row + ':' + p.col), b.map(p => p.row + ':' + p.col));
  });
  test('tabaka başına n aşılır yok; küçük tabakada mevcuda düşer', () => {
    const s = dgValStratifiedSample(hucreler(), { perStratum: 10, seed: 7 });
    const say = {};
    for (const p of s) say[p.mapClass] = (say[p.mapClass] || 0) + 1;
    assert.equal(say.green, 10);
    assert.equal(say.water, 8);   /* 8 hücre var, 10 istendi → 8 */
    assert.equal(say.hard, 5);    /* 5 hücre var */
    assert.equal(say.bare, undefined);
  });
  test('tekrarsız seçim (aynı hücre iki kez örneklenmez)', () => {
    const s = dgValStratifiedSample(hucreler(), { perStratum: 10, seed: 9 });
    const keys = s.map(p => p.mapClass + '|' + p.row + ':' + p.col);
    assert.equal(new Set(keys).size, keys.length);
  });
  test('noktalar hücre dörtgeni İÇİNDE (jitter taşmaz)', () => {
    const s = dgValStratifiedSample(hucreler(), { perStratum: 8, seed: 11 });
    const cells = hucreler();
    for (const p of s) {
      const c = cells.find(x => x.row === p.row && x.col === p.col && x.classKey === p.mapClass);
      assert.ok(c, 'örnek kaynağı hücre bulunamadı');
      const lats = c.quadWgs.map(q => q[1]), lons = c.quadWgs.map(q => q[0]);
      assert.ok(p.lat >= Math.min(...lats) && p.lat <= Math.max(...lats), 'lat hücre dışında');
      assert.ok(p.lon >= Math.min(...lons) && p.lon <= Math.max(...lons), 'lon hücre dışında');
    }
  });
  test('kenar hücreleri (alan < eşik) örneklenmez', () => {
    const cells = hucreler();
    cells.push({ row: 99, col: 99, classKey: 'water', classCode: 80, areaM2: 12,
      center: { lat: 40.5, lon: 32.5 }, quadWgs: null });
    const s = dgValStratifiedSample(cells, { perStratum: 20, seed: 3 });
    assert.ok(!s.some(p => p.row === 99), 'kenar hücresi örneklendi');
  });
  test('PRNG tekdüze ve [0,1) aralığında', () => {
    const rng = dgValRng(1234);
    for (let i = 0; i < 1000; i++) { const v = rng(); assert.ok(v >= 0 && v < 1); }
  });
});

describe('lc-validate · spektral kural seti (eşikler literatür çapalı + Göksu canlı kalibrasyonu)', () => {
  const n = (o) => Object.assign({ obs: 5 }, o);
  test('açık vejetasyon → green', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.8, mndwi: -0.2, ndbi: -0.3 })), 'green');
  });
  test('açık su → water (MNDWI ≥ 0.20 ve MNDWI ≥ NDVI)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.05, mndwi: 0.6, ndbi: -0.5 })), 'water');
  });
  test('⭐ Göksu 2026-10-03 canlı dersi: sığ/bulanık göl (NDBİ pozitif!) → water', () => {
    /* Göksu Parkı su hücrelerinin ölçülen medyanı: NDVI −0.233, MNDWI 0.416,
     * NDBI +0.256. Eski kural (MNDWI≥0.4 + NDBI-sert) bu hücrelerin %37'sini
     * kaçırıp sert zemine kaptırıyordu; görelilik koşulu (MNDWI≥NDVI) düzeltti. */
    assert.equal(dgValSpectralPredict(n({ ndvi: -0.233, mndwi: 0.416, ndbi: 0.256 })), 'water');
  });
  test('yüzen vejetasyon (NDVI > MNDWI, ikisi de yüksek) → green (taç = yeşil)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.9, mndwi: 0.5, ndbi: -0.5 })), 'green');
  });
  test('⭐ Göksu dersi: ağaç gölgeli sert zemin (NDBI negatif, IBI pozitif) → hard', () => {
    /* Ölçülen medyan: NDVI 0.276, MNDWI −0.272, NDBI −0.052 → IBI ≈ +0.048.
     * Ham NDBI≥0.10 kuralı bunu KAÇIRIYORDU (%3.5 uzlaşma); Xu 2008 IBI
     * üç indeksi birleştirdiği için karışım bandında da yakalar. */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.276, mndwi: -0.272, ndbi: -0.052 })), 'hard');
  });
  test('klasik yapılı yüzey → hard', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.25, mndwi: -0.15, ndbi: 0.15 })), 'hard');
  });
  test('çıplak toprak → bare (Göksu medyanı: NDVI 0.16)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.16, mndwi: -0.195, ndbi: -0.012 })), 'bare');
  });
  test('karışık/belirsiz piksel → ambiguous (sınıfa ZORLANMAZ)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.30, mndwi: 0.05, ndbi: 0.02 })), 'ambiguous');
  });
  test('yetersiz gözlem (< MIN_OBS) → nodata', () => {
    assert.equal(dgValSpectralPredict({ ndvi: 0.9, mndwi: -0.3, ndbi: -0.4, obs: 2 }), 'nodata');
    assert.equal(dgValSpectralPredict(null), 'nodata');
  });
  test('⭐ mevsimsel su: yaz medyanı kuru ama sezon MAX MNDWI ≥ 0.45 → water', () => {
    /* Göksu göl kıyısı: haziranda su, ağustosta çamur — medyan 0.05,
     * max 0.70. WorldCover 80 "yılın çoğunda su" tanımıyla uyumlu hüküm. */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.15, mndwi: 0.05, ndbi: 0.0, mndwiMax: 0.70 })), 'water');
  });
  test('max-su kanıtı yoğun tacı suya çevirmez (NDVI ≥ 0.50 → green)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.60, mndwi: 0.10, ndbi: -0.20, mndwiMax: 0.55 })), 'green');
  });
  test('⭐ parlak asfalt (NDVI < 0.20, IBI > 0.10, yıl boyu vejetasyonsuz) → hard', () => {
    /* IBI(0.12, −0.30, 0.05) = 0.0952 − (0.1071 − 0.4286) = +0.4167 */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.12, mndwi: -0.30, ndbi: 0.05 })), 'hard');
  });
  test('⭐ DOĞAL YAŞAM dersi (park 5): kuru step çayırı bahar kanıtıyla → green', () => {
    /* Ağustos: NDVI 0.241 + IBI pozitif → naif kural "sert" derdi (✗6003).
     * Bahar yeşillenmesi ndviMaxYear 0.55 → sınıf 30 kanıtı. */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.241, mndwi: -0.468, ndbi: 0.090, ndviMaxYear: 0.55 })), 'green');
  });
  test('⭐ kuru parlak toprak (mevsimsel yeşillenme var) → bare, asfalta kaçmaz', () => {
    /* Park 5 sınıf 60 medyanı: IBI 0.46 (asfalt gibi!) ama ndviMaxYear 0.30
     * ≥ 0.25 → toprak baharda yeşeriyor → bare. */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.097, mndwi: -0.280, ndbi: 0.084, ndviMaxYear: 0.30 })), 'bare');
  });
  test('asfalt/toprak ayrımı yıl boyu vejetasyon yokluğuna bakar (ndviMaxYear < 0.25 → hard)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.097, mndwi: -0.280, ndbi: 0.084, ndviMaxYear: 0.14 })), 'hard');
  });
  test('çamur/ıslak toprak (zayıf IBI, düşük NDVI) → bare', () => {
    /* IBI(0.10, 0.05, −0.15) = −0.3529 − (0.0909 + 0.0476) = −0.4915 ≤ 0 */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.10, mndwi: 0.05, ndbi: -0.15 })), 'bare');
  });
  test('yaz sonu kurumuş çim (NDVI 0.2-0.35, IBI ≤ 0) → ambiguous (zorlama yok)', () => {
    /* IBI(0.30, −0.20, −0.10) = −0.2222 − (0.2308 − 0.25) = −0.2030 */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.30, mndwi: -0.20, ndbi: -0.10 })), 'ambiguous');
  });
  test('⭐ baharda yeşeren çim (ndviMax ≥ 0.50) → green — mevsimsel kalıcılık', () => {
    /* WorldCover 30 vejetasyonun VARLIĞINI haritalar; yaz kuruması sınıfı
     * değiştirmez. ndviMax kanıtı insan etiketiyle uyumu sağlar. */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.28, mndwi: -0.25, ndbi: -0.05, ndviMax: 0.62 })), 'green');
  });
  test('taç gölgeli otopark (ndviMax 0.45 < 0.50) → hard kalır, yeşile kaçmaz', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.28, mndwi: -0.27, ndbi: -0.05, ndviMax: 0.45 })), 'hard');
  });
  test('⭐ mevsimsel göl kıyısı: yıllık MAX MNDWI ≥ 0.45 → water (WorldCover 80 semantiği)', () => {
    /* Göksu kıyı hücresi: yazın çamur (mndwi 0.02, ndbi +0.1 → IBI sert
     * derdi), ilkbaharda açık su (mndwiMaxYear 0.8). Yıllık kanıt düzeltir. */
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.12, mndwi: 0.02, ndbi: 0.10, ndviMax: 0.20, mndwiMaxYear: 0.80 })), 'water');
  });
  test('yıllık su kanıtı sazlığı suya çevirmez (ndviMax ≥ 0.50 → green)', () => {
    assert.equal(dgValSpectralPredict(n({ ndvi: 0.35, mndwi: 0.10, ndbi: -0.10, ndviMax: 0.72, mndwiMaxYear: 0.60 })), 'green');
  });
  test('NaN girdi yayılmaz → nodata', () => {
    assert.equal(dgValSpectralPredict({ ndvi: NaN, mndwi: 0.5, ndbi: 0, obs: 5 }), 'nodata');
  });
  test('IBI formülü elle hesapla birebir (Xu 2008)', () => {
    /* IBI(0.276, −0.272, −0.052) = 2(−0.052)/0.948 − [0.276/1.276 + (−0.272)/0.728]
     *   = −0.10970 − [0.21630 − 0.37363] = −0.10970 + 0.15733 = +0.04762 */
    const v = app.dgValIbi(0.276, -0.272, -0.052);
    assert.ok(Math.abs(v - 0.047625) < 1e-4, 'IBI=' + v);
  });
  test('MIN_OBS guard lc-validate sabitiyle tek kaynaktan (zincir sırası kanıtı)', () => {
    assert.equal(DG_S2_MIN_OBS_GUARD, DG_VAL_SPECTRAL.MIN_OBS);
    assert.equal(DG_S2_MIN_OBS_GUARD, 3);
  });
});

describe('lc-validate · otomatik uzlaşma (hücre bazında)', () => {
  const cells = [
    { row: 1, col: 1, classKey: 'water', areaM2: 100, center: { lat: 40, lon: 32 } },
    { row: 1, col: 2, classKey: 'water', areaM2: 100, center: { lat: 40, lon: 32.001 } },
    { row: 2, col: 1, classKey: 'green', areaM2: 100, center: { lat: 40.001, lon: 32 } },
    { row: 2, col: 2, classKey: 'green', areaM2: 40, center: { lat: 40.001, lon: 32.001 } }, /* kenar */
    { row: 3, col: 1, classKey: 'hard', areaM2: 100, center: { lat: 40.002, lon: 32 } },
  ];
  const spectral = {
    '1:1': { obs: 5, ndvi: 0.05, mndwi: 0.6, ndbi: -0.5 },   /* water ✓ */
    '1:2': { obs: 5, ndvi: 0.7, mndwi: -0.2, ndbi: -0.3 },   /* green ✗ (harita water) → flagged */
    '2:1': { obs: 5, ndvi: 0.75, mndwi: -0.15, ndbi: -0.3 }, /* green ✓ */
    '2:2': { obs: 5, ndvi: 0.8, mndwi: -0.2, ndbi: -0.3 },   /* kenar → hariç */
    '3:1': { obs: 5, ndvi: 0.3, mndwi: 0.05, ndbi: 0.02 },   /* ambiguous → aday değil */
  };
  const ag = dgValAgreement(cells, spectral);
  test('uyuşan/uyuşmayan sayımı doğru', () => {
    assert.equal(ag.perClass.water.agree, 1);
    assert.equal(ag.perClass.water.disagree, 1);
    assert.equal(ag.perClass.green.agree, 1);
    assert.equal(ag.perClass.green.edge, 1);
    assert.equal(ag.perClass.hard.ambiguous, 1);
    assert.equal(ag.nCandidates, 3);
  });
  test('genel uzlaşma yüzdesi adaylar üzerinden', () => {
    assert.ok(Math.abs(ag.overallPct - 66.7) < 0.1, ag.overallPct);
  });
  test('uyuşmazlık hücreleri konum+kanca ile işaretlenir (gözden geçirme kuyruğu)', () => {
    assert.equal(ag.flagged.length, 1);
    assert.equal(ag.flagged[0].mapClass, 'water');
    assert.equal(ag.flagged[0].specClass, 'green');
    assert.equal(ag.flagged[0].row, 1);
  });
  test('aday yoksa overallPct null (uydurma %100 yok)', () => {
    assert.equal(dgValAgreement([], {}).overallPct, null);
  });
});

describe('lc-validate · kapı hükmü (eşikler kilitli)', () => {
  const iyi = { oa: 0.88, kappa: 0.79, perClass: { water: { ua: 0.95 } } };
  const agIyi = { overallPct: 85 };
  test('tümü geçince 🟢 GECERLI', () => {
    const g = dgValGate(iyi, agIyi, 40);
    assert.equal(g.state, 'GECERLI');
    assert.match(g.label, /🟢/);
    assert.equal(g.reasons.length, 0);
  });
  test('OA kritik eşik altı → 🔴 KRITIK', () => {
    const g = dgValGate({ ...iyi, oa: 0.55 }, agIyi, 40);
    assert.equal(g.state, 'KRITIK');
    assert.ok(g.reasons.some(r => /kritik/i.test(r)));
  });
  test('su UA kritik eşik altı → 🔴 KRITIK', () => {
    const g = dgValGate({ oa: 0.85, kappa: 0.7, perClass: { water: { ua: 0.6 } } }, agIyi, 40);
    assert.equal(g.state, 'KRITIK');
  });
  test('ara bölge → 🟡 INCELEME (kappa/su/uzlaşma sebepli)', () => {
    const g = dgValGate({ oa: 0.75, kappa: 0.55, perClass: { water: { ua: 0.8 } } }, { overallPct: 65 }, 40);
    assert.equal(g.state, 'INCELEME');
    assert.ok(g.reasons.length >= 3);
  });
  test('n < 30 → tek başına İNCELEME (onay rozeti verilemez)', () => {
    const g = dgValGate(iyi, agIyi, 12);
    assert.equal(g.state, 'INCELEME');
    assert.ok(g.reasons.some(r => /yetersiz/i.test(r)));
  });
  test('eşik sabitleri değişirse test kırılır (bilinçli değişiklik şart)', () => {
    assert.equal(DG_VAL_GATE.OA_PASS, 0.80);
    assert.equal(DG_VAL_GATE.OA_FAIL, 0.65);
    assert.equal(DG_VAL_GATE.WATER_UA_PASS, 0.90);
    assert.equal(DG_VAL_GATE.WATER_UA_FAIL, 0.75);
    assert.equal(DG_VAL_GATE.KAPPA_PASS, 0.60);
    assert.equal(DG_VAL_GATE.SPEC_AGREE_PASS, 0.70);
    assert.equal(DG_VAL_GATE.MIN_N, 30);
  });
  test('metrik yok + uzlaşma yok → hüküm yine üretilir (örneklem yetersiz)', () => {
    const g = dgValGate(null, null, 0);
    assert.equal(g.state, 'INCELEME');
  });
});

describe('lc-validate · serileştirme ve kalıcılık sözleşmesi', () => {
  const kampanya = () => {
    const conf = dgValConfusion(referansOrnekler());
    const metrics = dgValMetrics(conf, REF_W, REF_A);
    return {
      id: 'val-5-123', parkId: 5, parkName: 'Test Parkı', seed: 42,
      samples: [{ id: 'S001', lat: 40.1, lon: 32.1, row: 1, col: 1, mapClass: 'water', refClass: 'water', areaM2: 100 }],
      labels: { S001: 'water' }, metrics, confusion: conf,
      gate: dgValGate(metrics, { overallPct: 90 }, 30),
      createdAt: '2026-10-03T00:00:00Z', engineVersion: '4.2.0',
    };
  };
  test('CSV BOM + başlıklar + metrik satırları taşır', () => {
    const csv = dgValCsv(kampanya());
    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /POINT_ID,LAT,LON,MAP_CLASS,REF_CLASS/);
    assert.match(csv, /OA,OA_CI95,KAPPA,N,N_AMBIGUOUS/);
    assert.match(csv, /CLASS,N,CORRECT,UA,UA_CI95,PA,ADJ_AREA_HA/);
    assert.match(csv, /GATE_STATE/);
    assert.match(csv, /"val-5-123"/);
  });
  test('JSON şema alanı ve parmak izi taşır', () => {
    const j = JSON.parse(dgValCampaignJson(kampanya()));
    assert.equal(j.schema, 'dendrogeo-lc-validation/1');
    assert.equal(j.validateVersion, '1.0.0');
    assert.equal(j.engineVersion, '4.2.0');
    assert.equal(j.seed, 42);
    assert.ok(j.metrics && j.gate);
  });
});

describe('lc-s2 · Sentinel-2 sabitleri ve saf yardımcılar', () => {
  test('koleksiyon ve bant sözleşmesi (Planetary Computer sentinel-2-l2a)', () => {
    assert.equal(DG_S2_COLLECTION, 'sentinel-2-l2a');
    assert.deepEqual(Object.keys(app.DG_S2_BANDS).sort(), ['B03', 'B04', 'B08', 'B11', 'SCL']);
    assert.equal(app.DG_S2_SCALE, 10000);
  });
  test('SCL geçerli sınıflar {2,4,5,6,7} — bulut/gölge/kar maskeli', () => {
    assert.deepEqual([...DG_S2_SCL_VALID], [2, 4, 5, 6, 7]); /* vm-realm dizisi → yayarak karşılaştır */
    for (const bad of [0, 1, 3, 8, 9, 10, 11]) assert.ok(!DG_S2_SCL_VALID.includes(bad));
  });
  test('sahne tavanı mobil bütçeli (≤6)', () => {
    assert.ok(DG_S2_MAX_SCENES <= 6);
  });
  test('medyan: tek/çift/aykırı dayanıklı', () => {
    assert.equal(dgS2Median([5]), 5);
    assert.equal(dgS2Median([1, 2, 3, 4]), 2.5);
    assert.equal(dgS2Median([10, 10, 10, 1000]), 10); /* aykırı bastırıldı */
    assert.equal(dgS2Median([]), null);
  });
  test('referans dönemi: WorldCover yılı vejetasyon sezonu (fenolojik tutarlılık)', () => {
    const r = dgS2SeasonRange(2021, 'ref');
    assert.equal(r.start, '2021-06-01T00:00:00Z');
    assert.equal(r.end, '2021-09-30T23:59:59Z');
    const g = dgS2SeasonRange(2021, 'latest');
    assert.notEqual(g.start, r.start);
    assert.match(g.label, /güncel/i);
  });
  test('STAC araması GET kuralı korunuyor (CORS dersi — lc-stac mirası)', () => {
    const src = rd('src/services/lc-s2.js');
    assert.match(src, /DG_LC_STAC\+"\/search\?"\+qs\.toString\(\)/);
    assert.ok(!/method\s*:\s*"POST"/.test(src), 'POST preflight 405 tuzağı geri gelmemeli');
  });
});

describe('lc-validate · hassasiyet kaydırıcıları (0054 · kullanıcı isteği)', () => {
  const n = (o) => Object.assign({ obs: 5 }, o);
  const S50 = { green: 50, water: 50, hard: 50, bare: 50 };

  test('⭐ varsayılan (sens yok) === 50/50/50/50 — literatür kalibrasyonu DEĞİŞMEZ', () => {
    const pikseller = [
      n({ ndvi: 0.8, mndwi: -0.2, ndbi: -0.3 }),
      n({ ndvi: -0.233, mndwi: 0.416, ndbi: 0.256 }),
      n({ ndvi: 0.276, mndwi: -0.272, ndbi: -0.052 }),
      n({ ndvi: 0.16, mndwi: -0.195, ndbi: -0.012 }),
      n({ ndvi: 0.12, mndwi: -0.30, ndbi: 0.05, ndviMaxYear: 0.12 }),
      n({ ndvi: 0.30, mndwi: -0.20, ndbi: -0.10 }),
      n({ ndvi: 0.05, mndwi: 0.6, ndbi: -0.5 }),
      n({ ndvi: 0.30, mndwi: 0.05, ndbi: 0.02 }),
    ];
    for (const px of pikseller) {
      assert.equal(dgValSpectralPredict(px, S50), dgValSpectralPredict(px),
        '50 kaydırıcısı taban davranışı değiştirdi: ' + JSON.stringify(px));
    }
  });

  test('yeşil hassasiyeti ↑ (100): kuruya yakın çim adaya döner (NDVI eşiği 0.35→0.20)', () => {
    const px = n({ ndvi: 0.30, mndwi: -0.20, ndbi: -0.10, ndviMaxYear: 0.42 });
    assert.equal(dgValSpectralPredict(px), 'ambiguous');
    assert.equal(dgValSpectralPredict(px, { green: 100 }), 'green');
    assert.equal(dgValSpectralPredict(px, { green: 0 }), 'ambiguous');
  });

  test('⭐ su hassasiyeti ↑ (100): sığ/bulanık su adaya döner (MNDWI eşiği 0.20→0.05)', () => {
    const px = n({ ndvi: -0.10, mndwi: 0.10, ndbi: 0.20 });
    assert.equal(dgValSpectralPredict(px), 'hard');
    assert.equal(dgValSpectralPredict(px, { water: 100 }), 'water');
  });

  test('su hassasiyeti ↓ (0): yalnız en net su kalır (MNDWI eşiği 0.20→0.35)', () => {
    const px = n({ ndvi: -0.20, mndwi: 0.25, ndbi: 0.10 });
    assert.equal(dgValSpectralPredict(px), 'water');
    /* eşik 0.35'e çıkınca 0.25'lik piksel su sayılmaz; kuru da değil
     * (MNDWI ≥ 0.20) → belirsiz: insan kararına gider (zorlama yok). */
    assert.equal(dgValSpectralPredict(px, { water: 0 }), 'ambiguous');
  });

  test('sert hassasiyeti ↑ (100): IBI eşiği 0→−0.25, zayıf kanıtlı piksel adaya döner', () => {
    const px = n({ ndvi: 0.22, mndwi: -0.15, ndbi: -0.08 });
    assert.equal(dgValSpectralPredict(px), 'ambiguous');
    assert.equal(dgValSpectralPredict(px, { hard: 100 }), 'hard');
  });

  test('çıplak hassasiyeti ↑ (100): NDVI bandı 0.20→0.275 genişler', () => {
    const px = n({ ndvi: 0.24, mndwi: -0.30, ndbi: -0.35 });
    assert.equal(dgValSpectralPredict(px), 'ambiguous');
    assert.equal(dgValSpectralPredict(px, { bare: 100 }), 'bare');
  });

  test('eşik eğimleri taban etrafında simetrik ve sınırlı (0..100 clamp)', () => {
    const t0 = app.dgValThr({ green: -50, water: 999, hard: 'x', bare: null });
    assert.ok(t0.ndviGreenMin >= 0.20 - 1e-9 && t0.ndviGreenMin <= 0.50 + 1e-9);
    const t1 = app.dgValThr();
    assert.ok(Math.abs(t1.ndviGreenMin - 0.35) < 1e-9);
    assert.ok(Math.abs(t1.mndwiWaterMin - 0.20) < 1e-9);
    assert.ok(Math.abs(t1.ibiHardMin - 0.0) < 1e-9);
    assert.ok(Math.abs(t1.ndviBareMax - 0.20) < 1e-9);
  });

  test("agreement sens parametresini predict'e geçirir (aday kümesi kaydırıcıyla değişir)", () => {
    const cells = [
      { row: 1, col: 1, classKey: 'water', areaM2: 100, center: { lat: 40, lon: 32 } },
    ];
    const spectral = { '1:1': { obs: 5, ndvi: -0.10, mndwi: 0.10, ndbi: 0.20 } };
    const a50 = dgValAgreement(cells, spectral, {});
    const a100 = dgValAgreement(cells, spectral, { sens: { water: 100 } });
    assert.equal(a50.perClass.water.agree, 0);   /* 50'de hard'a düşer → uyuşmaz */
    assert.equal(a100.perClass.water.agree, 1);  /* 100'de water → uzlaşma */
  });
});

describe('entegrasyon zinciri kilitleri (0054 · lc-sens)', () => {
  const lazy = rd('src/utils/lazylibs.js');
  const sw = rd('sw.js');
  const panel = rd('src/ui/park-panel.js');
  const exportJs = rd('src/ui/park-export.js');
  const i18n = rd('src/config/i18n.js');
  const sens = rd('src/ui/lc-sens.js');
  const css = rd('css/park-panel.css');

  test('⭐ zincir sırası: validate → s2 → lc-report → lc-sens → facade', () => {
    const idx = ['src/services/lc-validate.js', 'src/services/lc-s2.js',
      'src/ui/lc-report.js', 'src/ui/lc-sens.js', 'src/services/landcover.js']
      .map(f => lazy.indexOf('"' + f + '"'));
    for (const i of idx) assert.ok(i > -1, 'zincirde eksik');
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), 'sıra bozuk');
    assert.ok(!lazy.includes('lc-workbench'), 'workbench zincirden silinmeliydi (0054)');
  });

  test('lc-sens sw.js CORE_ASSETS’te; workbench precache’ten düştü', () => {
    assert.ok(sw.includes("'/src/ui/lc-sens.js'"));
    assert.ok(sw.includes("'/src/services/lc-validate.js'"));
    assert.ok(sw.includes("'/src/services/lc-s2.js'"));
    assert.ok(!sw.includes('lc-workbench'), 'workbench precache’te kalmamalı');
  });

  test('panel: lcSens kabı rapor barlarının altında + kart numaraları geri alındı', () => {
    assert.match(panel, /id="lcSens"/);
    assert.ok(panel.indexOf('id="landCoverReport"') < panel.indexOf('id="lcSens"'),
      'lcSens, landCoverReport’tan SONRA gelmeli (barların altı)');
    assert.ok(!panel.includes('valWorkbench'), 'workbench kartı silinmeliydi');
    assert.ok(!panel.includes('dgValOpen'), 'workbench köprüsü silinmeliydi');
    assert.match(panel, /3 · RAPOR PNG/);
    assert.match(panel, /4 · KATMANLAR/);
  });

  test('köprü: analiz bitince DG_LC_SENS.mount otomatik (typeof+try korumalı)', () => {
    assert.match(exportJs, /window\.DG_LC_SENS&&typeof window\.DG_LC_SENS\.mount==="function"/);
    assert.match(exportJs, /window\.DG_LC_SENS\.mount\("lcSens"\)/);
    assert.ok(!/function dgValOpen/.test(exportJs), 'eski köprü kalmamalı');
  });

  test('clearPark → lc-sens cleanup kancası (park değişince katman/kayıt düşer)', () => {
    assert.match(panel, /DG_LC_SENS&&typeof window\.DG_LC_SENS\.cleanup==="function"/);
  });

  test('⭐ KIRMIZI ÇİZGİ: hassasiyet paneli sayısal hatta DOKUNMAZ', () => {
    const facade = rd('src/services/landcover.js');
    const engine = rd('src/services/lc-engine.js');
    for (const src of [facade, engine]) {
      assert.ok(!/dgVal|DG_LC_VALIDATE|DG_LC_S2|dgS2|DG_LC_SENS|dgSens/.test(src), 'sayısal hat doğrulama modülüne bağlanmış');
    }
    /* lc-sens DG_LC_LAST'i yalnız OKUR; groupAreas'a YAZAMAZ */
    assert.ok(!/DG_LC_LAST\s*=/.test(sens), 'lc-sens DG_LC_LAST’e yazamaz');
    assert.ok(!/groupAreas\s*[=.]/.test(sens.replace(/groupAreas\)/g, '')), 'lc-sens alan sonuçlarını değiştiremez');
    /* kararlar corrections kaydında — hücre sınıfına yerinde müdahale yok */
    assert.ok(!/classKey\s*=/.test(sens), 'lc-sens hücre classKey’ini değiştiremez');
  });

  test('mobil sözleşme: kaydırıcı ≥44px + dg-png ailesi + animasyon YOK', () => {
    assert.match(css, /\.dg-sens-slider\{[^}]*min-height:44px/);
    assert.match(sens, /dg-png-btn/);
    assert.match(sens, /type="range"/);
    assert.ok(!/dg-sens[^{]*\{[^}]*animation/.test(css), 'sens CSS animasyon ekleyemez');
    assert.ok(!/\.dg-valw-[\w-]+\s*\{/.test(css), 'ölü .dg-valw-* kuralları css’te kalmamalı (0054)');
  });

  test('CSS ölü sınıf yok: lc-sens şablonlarındaki her dg-sens-* sınıfı css’te tanımlı', () => {
    const used = new Set([...sens.matchAll(/dg-sens-[\w-]+/g)].map(m => m[0]));
    const missing = [...used].filter(c => !css.includes('.' + c));
    assert.deepEqual(missing, [], 'css’te tanımsız sınıf: ' + missing.join(', '));
  });

  test('i18n: panel anahtar dizeleri sözlükte', () => {
    for (const s of [
      'UYDU HASSASİYET',
      'Hücreye dokun: ✅ Kabul (uydu gördüğün sınıf) · ❌ Harita doğru · ↩ Geri al. Kararlar bu park için kalıcıdır; raster sonucu değişmez, düzeltme katmanı ayrıca tutulur.',
      'Harita doğru',
      'Hepsini kabul',
      'Güncel sezon (en yeni görüntü)',
      'Kararları sıfırla',
    ]) assert.ok(i18n.includes(JSON.stringify(s) + ':'), 'eksik EN anahtarı: ' + s);
  });

  test('⭐ 0055 regresyon: hücre tıklaması haritaya KABARMAZ (park algılama sızıntısı kapalı)', () => {
    /* Kullanıcı bildirimi: "yeşil gridleri seçerken sistem tekrardan park
     * algılama moduna geçiyor" — interaktif polygon tıklaması DOM'da map
     * click'e kabarınca PARK_MODE açıkken dgDetectAt tetikleniyordu.
     * Bekçi: click handler özgün DOM olayında stopPropagation çağırmalı. */
    assert.match(sens, /poly\.on\("click",ev=>\{/);
    assert.match(sens, /L\.DomEvent\.stopPropagation\(oe\)/);
    assert.match(sens, /ev\.originalEvent\|\|ev/);
  });

  test('kalıcılık sözleşmesi: park başına tek kayıt (id "sens-<parkId>") + profil önbelleği', () => {
    assert.match(sens, /id:"sens-"\+\(pk\.id\|\|"x"\)/);
    assert.match(sens, /dgSensSave\(\)/);
    assert.match(sens, /loadCampaigns/);
    assert.match(sens, /rec\.profile=\{/);
  });
});
