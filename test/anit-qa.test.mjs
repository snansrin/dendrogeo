/* anit-qa.test.mjs — 0032 BEKÇİSİ: anıt ağaç ölçeği + Çizelge 4 okunurluğu.
 *
 * 2026-09-30 tarihli veri sahibi kararını kilitler:
 *  "Girdiğim ağaç değerleri gerçek, standart dışı olabilir ama DOĞRU veriler;
 *   ANIT AĞAÇ onlar. Ona göre raporu düzenle. Kontrol | Sonuç | Ayrıntı
 *   tablosunu da diğer tablolar gibi göster, bu şekilsiz olmuş."
 *
 * Bu dosyanın kilitlediği hükümler:
 *  1) ANITSALLIK: DBH ≥ 100 cm olan bireyler sayılır ve raporda ℹ️ BEYAN
 *     olarak bildirilir. Beyan, QA durumunu (🟢/🟡/🔴) ETKİLEMEZ.
 *  2) GÖVDE FORMU ÖLÇÜTÜ: sabit 15–120 bandı yerine (i) fiziksel makullük
 *     bandı 3–200 ve (ii) stand İÇİ robust aykırılık (modified z > 3,5).
 *     Tipik bant dışı kayıtlar yalnız SAYILIR (hd_band_out) → uyarı yok.
 *     hd_block KALICI false (0031 korunur).
 *  3) ÇİFT ρ KAYNAĞI: beklenen karbon hem tür düzeyi ρ hem grup varsayılanı ρ
 *     ile hesaplanır; saklı değer herhangi biriyle ±%20 içindeyse satır
 *     geçerlidir ve eşleşen kaynak sayıyla beyan edilir. Gerçek hesap
 *     hataları (10x ondalık kayması) YAKALANMAYA DEVAM EDER.
 *  4) ÇİZELGE 4 DÜZENİ: table.qa + colgroup (sabit kolonlar), .qd ayrıntı
 *     hücresi (orantılı yazı, kelime ortasından kırma YOK), .qst sonuç
 *     hücresi (tek satır, renkli). Masaüstü/mobil/print üçünde de tanımlı.
 *  5) MEVZUAT: basamaklar Ek-4 ile birebir; tescil hükmü VERİLMEZ, ŞAD/AAD
 *     puanlaması uygulanmaz (yaş ve tepe çapı envanterde yok).
 *  6) DOKUNULMAZLAR: karbon motoru/katsayılar, CSV biçimi, veri tabanı
 *     şeması, migrationlar, yayın kuyruğu ve YAYIMLANMIŞ rapor/ çıktıları
 *     DEĞİŞMEZ. Aynı veri + aynı formül aynı sayıları üretir.
 *
 * Not: Türkçe metinlerde kesme işareti kullanılmıyor; dosya tek tırnaklı
 * dizeler içerdiği için apostrof sözdizimini bozuyor.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, inventoryQa, buildMetadata } from '../scripts/make-report.mjs';
import {
  canonicalHash, loadSpeciesDict, loadRho, calcRow, QA_LIMITS, QA_STATE,
  medianOf, madOf, modifiedZ, anitGovdeBasamagi, ANIT_GOVDE_BASAMAKLARI, ANIT_MEVZUAT, MC_CFG,
} from '../scripts/lib/mc.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const dict = loadSpeciesDict();
const _base = loadRho();
const RHO = Object.assign({}, _base.rho);
for (const e of Object.values(dict.byName)) if (e.rho) RHO[e.tr] = e.rho;
const GRHO = _base.grho;
const carbonOf = (d, h, sp, gr) => calcRow(d, h, sp, gr, { rho: RHO, grho: GRHO }).total_carbon;
/* Grup varsayılanı ρ ile üretilmiş saklı değer (0011 SQL tablosunun deseni). */
const carbonGrup = (d, h, sp, gr) => calcRow(d, h, sp, gr, { rho: {}, grho: GRHO }).total_carbon;

/* ---------- Göksu benzeri fikstür: anıtsal gövdeler + çift ρ deseni ---------- */
const RAW = [
  { p: 1, sp: 'SÜS ERİĞİ', grp: 'YAPRAKLI', d: 110, h: 10.2, c: 'tur' },
  { p: 3, sp: 'SALKIM SÖĞÜT', grp: 'YAPRAKLI', d: 166, h: 14, c: 'grup' },
  { p: 7, sp: 'KARAÇAM', grp: 'İBRELİ', d: 107, h: 12, c: 'tur' },
  { p: 29, sp: 'IHLAMUR', grp: 'YAPRAKLI', d: 40, h: 4.5, c: 'tur' },
  { p: 32, sp: 'SALKIM SÖĞÜT', grp: 'YAPRAKLI', d: 200, h: 12.5, c: 'grup' },
  { p: 43, sp: 'SIĞLA', grp: 'YAPRAKLI', d: 57, h: 7.5, c: 'tur' },
];
const ROWS = RAW.map((r, i) => ({
  id: 200 + i, point_id: r.p, species: r.sp, grp: r.grp,
  dbh_cm: r.d, girth_cm: null, height_m: r.h,
  carbon_kg: +(r.c === 'grup' ? carbonGrup(r.d, r.h, r.sp, r.grp) : carbonOf(r.d, r.h, r.sp, r.grp)).toFixed(6),
  volume_m3: +calcRow(r.d, r.h, r.sp, r.grp, { rho: RHO, grho: GRHO }).vol.toFixed(3),
  lat: 39.99025 + i * 0.0002, lon: 32.65201 + i * 0.0002, acc_m: 4.2, photo: true,
  photo_file: `P${String(r.p).padStart(3, '0')}_M1.JPG`, date: '2026-09-28',
}));
const SUM = +ROWS.reduce((a, r) => a + r.carbon_kg, 0).toFixed(2);
const PARK_M2 = 501107;
const bySpecies = {};
for (const r of ROWS) {
  const k = r.species;
  bySpecies[k] = bySpecies[k] || { species: k, grp: r.grp, n: 0, dbh: 0, h: 0, carbon_kg: 0 };
  bySpecies[k].n++; bySpecies[k].dbh += r.dbh_cm; bySpecies[k].h += r.height_m; bySpecies[k].carbon_kg += r.carbon_kg;
}
const SPECIES = Object.values(bySpecies).map((s) => ({
  species: s.species, grp: s.grp, n: s.n,
  mean_dbh: +(s.dbh / s.n).toFixed(1), mean_h: +(s.h / s.n).toFixed(1),
  carbon_kg: +s.carbon_kg.toFixed(2), share_pct: +((100 * s.carbon_kg) / SUM).toFixed(1),
})).sort((a, b) => b.carbon_kg - a.carbon_kg);

const SNAP = {
  schema: 'dendrogeo-report/1',
  park: { id: 25, name: 'Göksu Parkı', osm_key: 'way/423602737', city: 'Ankara', country: 'Türkiye', area_m2: PARK_M2 },
  generated_at: '2026-09-30T12:00:00.000Z',
  mc: { ...MC_CFG },
  totals: { n: ROWS.length, carbon_kg: SUM, ci: { mean: SUM, lo: +(SUM * 0.55).toFixed(2), hi: +(SUM * 1.41).toFixed(2) }, per_ha_kg: +((SUM * 10000) / PARK_M2).toFixed(2) },
  species: SPECIES,
  gps: { n: ROWS.length, n_with_acc: ROWS.length, n_null_acc: 0, mean_acc_m: 4.2 },
  period: { from: '2026-09-28T09:00:00Z', to: '2026-09-28T15:00:00Z' },
  moderation: { approved: ROWS.length, reviewed: ROWS.length },
  geofence: { policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)', total: ROWS.length, verified_rows: ROWS.length, outside_rows: 0, polygon_source: 'OSM' },
  geometry_qa: { source: 'OSM way/423602737', ring_points: 111, ring_area_m2: 500000, self_intersections: 0 },
  provenance: { engine: 'DendroGeo LC Engine', engine_version: '4.2.0', app_version: '3.0.0', git_commit: 'abc1234def5678', report_id: 'DGR-2026-9101', epsg: 32636, resolution_m: 10, dataset: 'ESA WorldCover 10 m · 2021 (v200)' },
  lulc: {
    source: 'ESA WorldCover 10 m · 2021 (v200)', citation: 'ESA WorldCover 10 m 2021 v200, CC BY 4.0', year: 2021,
    cross: 'IO LULC', crossError: null, agreement: { green: { agreementPct: 91 } },
    areaDeltaPct: 0.059, cells: 5020, coverage_m2: 501200, classified_m2: 501200, epsg: 32636, masked_ha: 0,
    classes: [{ key: 'green', label: 'Yeşil alan', ha: 41.1, pct: 82 }, { key: 'hard', label: 'Sert yüzey', ha: 9.0, pct: 18 }],
  },
  rows: ROWS,
};

const QA = inventoryQa(SNAP.rows, dict);
const META = { id: 'DGR-2026-9101', git_commit: 'abc1234def5678', engine_version: '4.2.0', app_version: '3.0.0', epsg: 32636, resolution_m: 10, dataset: SNAP.lulc.source, history: [] };
const render = (qa, id = 'DGR-2026-9101') => {
  const s = { ...SNAP, qa: { species: qa, photos: { n_with: ROWS.length, n: ROWS.length } } };
  const hash = canonicalHash(s);
  return {
    html: renderReport(s, { id, hash, version: 1, meta: { ...META, id } }),
    md: buildMetadata(s, { id, hash, version: '1.0', meta: { ...META, id }, history: [] }),
    snap: s, hash,
  };
};
const R = render(QA);
const HTML = R.html, MD = R.md;
const stripTags = (x) => x.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
/* Çizelge 4ü olduğu gibi çözer: Kontrol | Sonuç | Ayrıntı */
const qaTable = (h) => {
  const i = h.indexOf('<th>Kontrol</th>');
  assert.ok(i > 0, 'Çizelge 4 bulunamadı');
  const s = h.lastIndexOf('<table', i), e = h.indexOf('</table>', i);
  return [...h.slice(s, e).matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<t[hd]([^>]*)>([\s\S]*?)<\/t[hd]>/g)].map((c) => ({ attr: c[1], txt: stripTags(c[2]), raw: c[2] })));
};
const QA_TBL = qaTable(HTML);
const rowOf = (ad) => QA_TBL.find((r) => r[0] && r[0].txt === ad);
const badge = (h) => (h.match(/<b>Rapor durumu<\/b><span class="([^"]*)">([^<]*)<\/span>/) || [])[2];

/* ============================ 1) EŞİKLER ============================ */
describe('0032 · QA eşikleri: 0031 değerleri KORUNDU, anıtsal/form eşikleri eklendi', () => {
  test('0031 eşikleri birebir aynı (motor ve kritik kontroller değişmedi)', () => {
    assert.equal(QA_LIMITS.DBH_MIN_CM, 1);
    assert.equal(QA_LIMITS.DBH_MAX_CM, 400);
    assert.equal(QA_LIMITS.HD_MIN, 15, 'tipik bant alt sınırı (bilgilendirme)');
    assert.equal(QA_LIMITS.HD_MAX, 120, 'tipik bant üst sınırı (bilgilendirme)');
    assert.equal(QA_LIMITS.CARBON_DEV_PCT, 20);
    assert.equal(QA_LIMITS.CARBON_DEV_MIN_KG, 5);
    assert.equal(QA_LIMITS.BLOCK_RATIO, 0.5);
    assert.equal(QA_LIMITS.BLOCK_MIN_N, 3);
  });
  test('0032 yeni eşikler: fiziksel form bandı + robust z + anıtsal gövde', () => {
    assert.equal(QA_LIMITS.HD_PHYS_MIN, 3);
    assert.equal(QA_LIMITS.HD_PHYS_MAX, 200);
    assert.equal(QA_LIMITS.H_MIN_M, 1.3, 'göğüs yüksekliği = ölçülebilen en küçük boy');
    assert.equal(QA_LIMITS.H_MAX_M, 100, 'dünya ağaç boyu rekoru ~100 m');
    assert.equal(QA_LIMITS.HD_ROBUST_Z, 3.5, 'Iglewicz–Hoaglin modified z eşiği');
    assert.equal(QA_LIMITS.HD_ROBUST_MIN_N, 5, 'küçük örneklemden sahte aykırı üretilmez');
    assert.equal(QA_LIMITS.ANIT_DBH_CM, 100, 'Ek-4te I. sınıf için çap puanlamasının başladığı basamak');
    /* fiziksel bant tipik bandı KAPSAR (tipik bant daha dar) */
    assert.ok(QA_LIMITS.HD_PHYS_MIN < QA_LIMITS.HD_MIN);
    assert.ok(QA_LIMITS.HD_PHYS_MAX > QA_LIMITS.HD_MAX);
  });
  test('hd_block kodda KALICI false (0031 hükmü korunur)', () => {
    assert.match(read('scripts/make-report.mjs'), /out\.hd_block = false;/);
  });
});

/* ====================== 2) MEVZUAT BASAMAKLARI ====================== */
describe('0032 · Ek-4 gövde çapı basamakları (İlke Kararı No: 110, RG 20.07.2022/31898)', () => {
  test('12 basamak ve etiketler mevzuatla birebir', () => {
    assert.equal(ANIT_GOVDE_BASAMAKLARI.length, 12);
    assert.deepEqual(ANIT_GOVDE_BASAMAKLARI.map((b) => b.label),
      ['<50', '50–74', '75–99', '100–124', '125–149', '150–174', '175–199', '200–224', '225–249', '250–274', '275–299', '≥300']);
  });
  test('sınır değerleri doğru basamağa düşer (alt sınır dahil, üst sınır hariç)', () => {
    const beklenen = [
      [0.5, '<50'], [49.9, '<50'], [50, '50–74'], [74.9, '50–74'], [75, '75–99'], [99.9, '75–99'],
      [100, '100–124'], [124.9, '100–124'], [125, '125–149'], [149.9, '125–149'], [150, '150–174'],
      [174.9, '150–174'], [175, '175–199'], [199.9, '175–199'], [200, '200–224'], [224.9, '200–224'],
      [225, '225–249'], [249.9, '225–249'], [250, '250–274'], [274.9, '250–274'], [275, '275–299'],
      [299.9, '275–299'], [300, '≥300'], [400, '≥300'],
    ];
    for (const [d, lab] of beklenen) assert.equal(anitGovdeBasamagi(d), lab, d + ' cm');
  });
  test('geçersiz girdide basamak UYDURULMAZ (null döner)', () => {
    for (const x of [null, undefined, '', 'yok', 0, -5, NaN]) assert.equal(anitGovdeBasamagi(x), null, String(x));
  });
  test('mevzuat künyesi: karar, kurum, RG, yürürlükten kaldırılan karar, yetki', () => {
    assert.match(ANIT_MEVZUAT.karar, /Anıt Ağaçların Tespitine İlişkin İlke Kararı/);
    assert.match(ANIT_MEVZUAT.karar, /110/);
    assert.equal(ANIT_MEVZUAT.rg_sayi, '31898');
    assert.equal(ANIT_MEVZUAT.rg_tarih, '2022-07-20');
    assert.match(ANIT_MEVZUAT.kurum, /Tabiat Varlıklarını Koruma Merkez Komisyonu/);
    assert.match(ANIT_MEVZUAT.yururluktenKaldirilan, /666/);
    assert.match(ANIT_MEVZUAT.yetki, /Tabiat Varlıklarını Koruma Bölge Komisyonu/);
    assert.match(ANIT_MEVZUAT.puanlama, /ŞAD/);
    assert.match(ANIT_MEVZUAT.puanlama, /AAD/);
    assert.match(ANIT_MEVZUAT.puanlamaUygulanmadi, /YAPILMAMIŞTIR/);
  });
});

/* ==================== 3) ROBUST İSTATİSTİK ÇEKİRDEĞİ ==================== */
describe('0032 · medianOf / madOf / modifiedZ (sağlam aykırılık göstergesi)', () => {
  test('medyan tek/çift örneklemde doğru', () => {
    assert.equal(medianOf([1, 2, 3]), 2);
    assert.equal(medianOf([1, 2, 3, 4]), 2.5);
    assert.equal(medianOf([]), null);
    assert.equal(medianOf([5, 'x', null, 7]), 6, 'sayısal olmayan değerler elenir');
  });
  test('MAD = medyan(|x − medyan|); MAD 0 ise ortalama mutlak sapmaya düşer', () => {
    assert.equal(madOf([1, 2, 3, 4], 2.5), 1);
    assert.equal(madOf([5, 5, 5, 9], 5), 1, 'MAD 0 → ortalama mutlak sapma (1)');
    assert.equal(madOf([5, 5, 5], 5), 0, 'hiç dağılım yoksa 0 → test koşulmaz');
  });
  test('modified z = 0,6745·(x − medyan)/MAD; MAD 0 ise 0 (sahte bayrak yok)', () => {
    assert.ok(Math.abs(modifiedZ(10, 2.5, 1.5) - 3.3725) < 1e-9);
    assert.equal(modifiedZ(5, 5, 0), 0);
    assert.equal(modifiedZ(NaN, 5, 1), 0);
  });
});

/* ================== 4) ÇİFT ρ KAYNAĞI (karbon denetimi) ================== */
describe('0032 · karbon yeniden hesabı İKİ ρ kaynağıyla yapılır', () => {
  const mk = (p, sp, grp, d, h, c) => ({ id: p, point_id: p, species: sp, grp: grp, dbh_cm: d, height_m: h, carbon_kg: c });

  test('grup varsayılanı ρ ile üretilmiş saklı değer GEÇERLİ sayılır (Göksu deseni)', () => {
    /* SALKIM SÖĞÜT: tür ρ=400, grup (YAPRAKLI) ρ=541 → karbon ~%34 farklı.
     * Saklı değer 541 ile üretildiği için 400 ile karşılaştırmak sahte
     * "bant dışı" üretiyordu (0031de 6/34 kayıt). */
    const d = 166, h = 14;
    const sakliGrup = +carbonGrup(d, h, 'SALKIM SÖĞÜT', 'YAPRAKLI').toFixed(6);
    const qa = inventoryQa([mk(3, 'SALKIM SÖĞÜT', 'YAPRAKLI', d, h, sakliGrup)], dict);
    assert.equal(qa.dev_fail.length, 0, 'grup ρ ile birebir → geçerli');
    const row = qa.rows[0];
    assert.equal(row.rho_src, 'grup');
    assert.ok(Math.abs(row.dev_pct) > QA_LIMITS.CARBON_DEV_PCT, 'tür ρ ile bant aşılır: ' + row.dev_pct);
    assert.ok(Math.abs(row.dev_grp_pct) <= QA_LIMITS.CARBON_DEV_PCT, 'grup ρ ile bant içinde: ' + row.dev_grp_pct);
    assert.equal(qa.dev_rho.grup_farkli.length, 1, 'beyan listesi');
    assert.equal(qa.dev_rho.grup_farkli[0].rho_tur, 400);
    assert.equal(qa.dev_rho.grup_farkli[0].rho_grp, 541);
    assert.equal(qa.state, QA_STATE.VALID);
  });

  test('gerçek hesap hatası (10x ondalık kayması) YAKALANMAYA DEVAM EDER', () => {
    const d = 107, h = 12;
    const dogru = carbonOf(d, h, 'KARAÇAM', 'İBRELİ');
    const qa = inventoryQa([mk(7, 'KARAÇAM', 'İBRELİ', d, h, +(dogru / 10).toFixed(1))], dict);
    assert.equal(qa.dev_fail.length, 1, 'her iki ρ kaynağıyla da bant dışı');
    assert.equal(qa.dev_fail[0].point_id, 7);
    assert.ok(Math.abs(qa.dev_fail[0].dev_pct) > 80, 'sapma: ' + qa.dev_fail[0].dev_pct);
    assert.ok(qa.dev_fail[0].expected_grp > 0, 'grup ρ beklenen değeri de beyan edilir');
    assert.equal(qa.rows[0].rho_src, null, 'eşleşen kaynak yok');
  });

  test('küçük kayıtlarda mutlak taban (≥5 kg) korunur', () => {
    const r = [mk(29, 'IHLAMUR', 'YAPRAKLI', 12.73, 4.5, 10.6)];
    const qa = inventoryQa(r, dict);
    assert.equal(qa.rows[0].dev_fail, false, 'dev ' + qa.rows[0].dev_pct + '% ama |fark| < 5 kg');
    assert.equal(qa.dev_fail.length, 0);
  });

  test('ρ kaynağı sayımı raporda beyan edilir (tür / grup)', () => {
    assert.equal(QA.dev_rho.n, 6, '6/6 kayıt yeniden üretildi');
    assert.equal(QA.dev_rho.tur + QA.dev_rho.grup, 6);
    assert.ok(QA.dev_rho.grup >= 2, 'en az SALKIM SÖĞÜT kayıtları grup ρ ile: ' + QA.dev_rho.grup);
    assert.deepEqual(QA.dev_rho.grup_farkli.map((x) => x.point_id), [3, 32]);
    assert.equal(QA.dev_fail.length, 0);
    assert.equal(QA.dev_block, false);
  });

  test('karbon MOTORU değişmedi: aynı girdi aynı altın değer', () => {
    const altin = calcRow(107, 12, 'KARAÇAM', 'İBRELİ', { rho: RHO, grho: GRHO });
    assert.ok(Math.abs(altin.total_carbon - 1972.827017) < 1e-4, 'altın değer: ' + altin.total_carbon);
    assert.ok(Math.abs(altin.bhb - altin.agb * 0.26) < 1e-9);
    assert.ok(Math.abs(altin.total_carbon - (altin.agb + altin.bhb) * 0.47) < 1e-9);
    /* katsayılar kaynak dosyalarda birebir */
    for (const k of ['0.0673', '0.976', '0.26', '0.47']) {
      assert.ok(read('scripts/lib/mc.mjs').includes(k), 'mc.mjs: ' + k);
      assert.ok(read('src/services/allometry.js').includes(k), 'allometry.js: ' + k);
    }
  });
});

/* =================== 5) GÖVDE FORMU + ANITSALLIK =================== */
describe('0032 · inventoryQa: anıtsal gövde beyanı + form göstergesi', () => {
  test('anıtsal gövde sayımı, en büyük çap ve Ek-4 basamak dağılımı', () => {
    assert.equal(QA.anit.threshold_cm, 100);
    assert.equal(QA.anit.n, 4, 'P1 110 · P3 166 · P7 107 · P32 200');
    assert.equal(QA.anit.n_toplam, 6);
    assert.equal(QA.anit.pct, 66.7);
    assert.equal(QA.anit.max_dbh_cm, 200);
    assert.deepEqual(QA.anit.points.map((x) => x.point_id), [1, 3, 7, 32]);
    assert.deepEqual(QA.anit.basamaklar, [
      { label: '<50', n: 1 }, { label: '50–74', n: 1 }, { label: '75–99', n: 0 },
      { label: '100–124', n: 2 }, { label: '125–149', n: 0 }, { label: '150–174', n: 1 },
      { label: '175–199', n: 0 }, { label: '200–224', n: 1 },
    ].filter((b) => b.n > 0), 'boş basamak basılmaz (P29 40 cm → <50)');
    assert.equal(QA.anit.basamaklar.reduce((a, b) => a + b.n, 0), QA.n, 'basamak toplamı = kayıt sayısı');
  });

  test('ℹ️ beyan QA durumunu ETKİLEMEZ: anıtsal gövde var ama durum 🟢 GEÇERLİ', () => {
    assert.ok(QA.anit.n > 0);
    assert.deepEqual(QA.info.map((x) => x.key), ['anit', 'rho-kaynagi']);
    assert.equal(QA.dbh_fail.length, 0);
    assert.equal(QA.hd_fail.length, 0);
    assert.equal(QA.dev_fail.length, 0);
    assert.equal(QA.n_unknown, 0);
    assert.equal(QA.state, QA_STATE.VALID, 'durum: ' + QA.state);
    assert.equal(badge(HTML), '🟢 GEÇERLİ');
  });

  test('tipik 15–120 bandı dışı kayıtlar SAYILIR ama uyarı üretmez', () => {
    assert.equal(QA.hd_band_out.length, 6, 'h/D: 9,27 · 8,43 · 11,21 · 11,25 · 6,25 · 13,16 → ' + JSON.stringify(QA.hd_band_out));
    assert.equal(QA.hd_fail.length, 0);
    assert.equal(QA.hd_review, false);
    assert.ok(QA.hd_stats, 'stand dağılımı hesaplandı');
    assert.equal(QA.hd_stats.n, 6);
    assert.ok(Math.abs(QA.hd_stats.z_max) <= QA_LIMITS.HD_ROBUST_Z, '|z|max = ' + QA.hd_stats.z_max);
    assert.ok(QA.hd_stats.min >= QA_LIMITS.HD_PHYS_MIN && QA.hd_stats.max <= QA_LIMITS.HD_PHYS_MAX);
  });

  test('satır düzeyi alanlar: hd_band_out / hd_z / rho_src / anit / anit_basamak', () => {
    const p3 = QA.rows.find((r) => r.point_id === 3);
    assert.equal(p3.anit, true);
    assert.equal(p3.anit_basamak, '150–174');
    assert.equal(p3.hd_band_out, true);
    assert.equal(p3.hd_fail, false);
    assert.equal(p3.rho_src, 'grup');
    assert.equal(p3.dbh_cm, 166, 'DBH olduğu gibi: dönüşüm YOK');
    assert.equal(p3.dbh_fail, false);
    const p29 = QA.rows.find((r) => r.point_id === 29);
    assert.equal(p29.anit, false);
    assert.equal(p29.anit_basamak, '<50');
  });

  test('anıtsal gövde eşiği altında kalan envanterde beyan satırı ✓ Geçerli', () => {
    const kucuk = [1, 2, 3, 4, 5].map((i) => ({ id: i, point_id: i, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 30 + i, height_m: 12, carbon_kg: null }));
    const qa = inventoryQa(kucuk, dict);
    assert.equal(qa.anit.n, 0);
    assert.equal(qa.anit.max_dbh_cm, null);
    assert.deepEqual(qa.info, [], 'beyan kalemi yok');
    const h = render(qa, 'DGR-2026-9102').html;
    const r = qaTable(h).find((x) => x[0].txt === 'Anıtsal gövde beyanı');
    assert.ok(r, 'satır her envanterde basılır');
    assert.equal(r[1].txt, '✓ Geçerli');
    assert.match(r[2].txt, /gövde çapı ≥ 100 cm olan birey bulunmuyor/);
  });
});

/* ================== 6) ÇİZELGE 4 DÜZENİ (görsel düzeltme) ================== */
describe('0032 · Çizelge 4 diğer çizelgeler gibi düzenli (sabit kolon + okunur hücre)', () => {
  test('markup: table.qa + colgroup (üç kolon, tanımlı genişlik)', () => {
    assert.match(HTML, /<table class="qa"><colgroup><col class="ck"><col class="cs"><col class="cd"><\/colgroup>/);
    assert.match(HTML, /<thead><tr><th>Kontrol<\/th><th>Sonuç<\/th><th>Ayrıntı<\/th><\/tr><\/thead>/);
    const i = HTML.indexOf('<th>Kontrol</th>');
    assert.ok(HTML.lastIndexOf('<div class="tscroll">', i) > i - 400, 'Çizelge 4 .tscroll kabında (mobilde yatay kayar)');
  });
  test('her satırda Kontrol class="tr", Sonuç .qst, Ayrıntı .qd', () => {
    assert.ok(QA_TBL.length >= 15, 'satır sayısı: ' + QA_TBL.length);
    for (const r of QA_TBL.slice(1)) {
      assert.equal(r.length, 3, 'üç hücre: ' + JSON.stringify(r.map((c) => c.txt)));
      assert.match(r[0].attr, /class="tr"/, 'kontrol hücresi');
      assert.match(r[1].attr, /qst/, 'sonuç hücresi tek satır sınıfı taşır');
      assert.match(r[2].attr, /class="qd"/, 'ayrıntı hücresi orantılı yazı sınıfı taşır');
    }
  });
  test('sonuç hücreleri renkli durum sınıflarını taşır (qok / qwarn / qbad / qinfo)', () => {
    const sonuclar = QA_TBL.slice(1).map((r) => r[1]);
    assert.ok(sonuclar.filter((c) => /qok/.test(c.attr)).length >= 10, '✓ Geçerli hücreleri: ' + sonuclar.length);
    const anit = rowOf('Anıtsal gövde beyanı');
    assert.equal(anit[1].txt, 'ℹ️ Beyan');
    assert.match(anit[1].attr, /qinfo/, 'beyan rengi ayrı (uyarıyla karışmaz)');
    assert.ok(!HTML.includes('⛔'), 'geçerli raporda ⛔ yok');
  });
  test('CSS: sabit kolon düzeni + ayrıntı hücresi kelime ortasından KIRILMAZ', () => {
    assert.match(HTML, /table\.qa\{table-layout:fixed\}/);
    assert.match(HTML, /table\.qa col\.ck\{width:23%\}table\.qa col\.cs\{width:16%\}table\.qa col\.cd\{width:61%\}/);
    assert.match(HTML, /td\.qd\{[^}]*overflow-wrap:break-word[^}]*\}/);
    assert.match(HTML, /td\.qd\{[^}]*word-break:normal/);
    assert.match(HTML, /td\.qst\{[^}]*white-space:nowrap/);
    assert.match(HTML, /td\.qinfo\{color:#1c5d8f/);
    assert.ok(!/td\.qd\{[^}]*anywhere/.test(HTML), 'ayrıntı hücresinde anywhere YOK');
  });
  test('mobil: üç kolon korunur, ayrıntı kırılmaz, sonuç gerekirse iki satıra iner', () => {
    const m = HTML.slice(HTML.indexOf('@media (max-width:640px)'), HTML.indexOf('@media print'));
    assert.match(m, /table\.qa\{min-width:540px\}/, 'dar ekranda .tscroll yatay kayar (diğer çizelgelerle aynı)');
    assert.match(m, /table\.qa td,table\.qa th\{overflow-wrap:break-word;word-break:normal\}/);
    assert.match(m, /table\.qa td\.qd\{font-size:\.75rem/);
    assert.match(m, /table\.qa td\.qst\{white-space:normal/, 'rozet taşmaz, satır sonunda iner');
  });
  test('print/PDF: Çizelge 4 üç kolonlu basılır, hücre taşmaz', () => {
    const p = HTML.slice(HTML.indexOf('@media print'));
    assert.match(p, /table\.qa\{table-layout:fixed\}/);
    assert.match(p, /table\.qa td\.qd\{font-size:8\.8pt/);
    assert.match(p, /table\.qa td\.qst\{white-space:normal;font-size:8\.4pt\}/);
    assert.match(p, /\.tscroll\{overflow:visible!important/, 'kağıtta kırpma yok (0027)');
  });
  test('uzun açıklamalı diğer çizelgeler de .qd kullanır (§4.6 sözlük, §10 kayıt)', () => {
    const i = HTML.indexOf('4.6 Veri sözlüğü');
    const seg = HTML.slice(i, HTML.indexOf('</table>', i));
    assert.ok((seg.match(/class="qd"/g) || []).length >= 7, 'veri sözlüğü açıklama hücreleri');
    const j = HTML.indexOf('<th>Öğe</th><th>Kayıt</th>');
    const seg2 = HTML.slice(HTML.lastIndexOf('<table', j), HTML.indexOf('</table>', j));
    assert.ok((seg2.match(/class="qd"/g) || []).length >= 5, 'tekrar üretilebilirlik hücreleri');
  });
  test('ayrıntı metninde ham HTML sızıntısı yok (etiketler dengeli)', () => {
    for (const r of QA_TBL.slice(1)) {
      for (const c of r) {
        assert.ok(!/<(td|tr|table)\b/i.test(c.raw), 'hücre içinde tablo etiketi yok: ' + c.txt.slice(0, 60));
        const open = (c.raw.match(/<b>/g) || []).length, close = (c.raw.match(/<\/b>/g) || []).length;
        assert.equal(open, close, 'b etiketi dengeli: ' + c.txt.slice(0, 60));
      }
    }
  });
});

/* =================== 7) RAPOR METNİ BEYANLARI =================== */
describe('0032 · rapor metni: anıtsallık beyanı, veri hatası iması YOK', () => {
  test('Çizelge 4 "Anıtsal gövde beyanı" satırı sayıyla ve mevzuatla', () => {
    const r = rowOf('Anıtsal gövde beyanı');
    assert.ok(r, 'satır var');
    assert.equal(r[1].txt, 'ℹ️ Beyan');
    const d = r[2].txt;
    assert.match(d, /4\/6 bireyin gövde çapı ≥ 100 cm/);
    assert.match(d, /en büyük 200 cm/);
    assert.match(d, /ANITSAL GÖVDE/);
    assert.match(d, /Ek-4 gövde çapı basamak dağılımı/);
    assert.match(d, /200–224 cm: 1 birey/);
    assert.match(d, /P1, P3, P7, P32/);
    assert.match(d, /ℹ️ BEYANDIR/);
    assert.match(d, /rapor durumunu \(🟢\/🟡\/🔴\) ETKİLEMEZ/);
    assert.match(d, /veri hatası veya inceleme hükmü DEĞİLDİR/);
  });
  test('mevzuat dayanağı künyesiyle; tescil hükmü VERİLMİYOR', () => {
    const d = rowOf('Anıtsal gövde beyanı')[2].txt;
    assert.match(d, /Tabiat Varlığı Olarak Belirlenecek Anıt Ağaçların Tespitine İlişkin İlke Kararı/);
    assert.match(d, /Tabiat Varlıklarını Koruma Merkez Komisyonu/);
    assert.match(d, /Resmî Gazete 20\.07\.2022 \/ Sayı 31898/);
    assert.match(d, /666 sayılı İlke Kararı yürürlükten kaldırılmıştır/);
    assert.match(d, /TESCİL HÜKMÜ DEĞİLDİR/);
    assert.match(d, /ŞAD/);
    assert.match(d, /AAD/);
    assert.match(d, /ŞAD\/AAD puanlaması YAPILMAMIŞTIR/);
    assert.match(d, /Tabiat Varlıklarını Koruma Bölge Komisyonu/);
    /* mevzuatın çevre÷3,14 tanımı ile DendroGeo çap kaydı arasındaki fark beyan edilir */
    assert.match(d, /çevre→çap dönüşümü UYGULANMAMIŞTIR/);
  });
  test('kullanıcı beyanı: standart dışı görünen değerler VERİ HATASI sayılmaz', () => {
    assert.match(HTML, /bireyler <b>anıtsal gövde<\/b> ölçeğindedir/);
    assert.match(HTML, /rapor bu değerleri veri hatası olarak <b>işaretlemez<\/b>/);
    assert.match(HTML, /Standart dışı görünen büyük çaplar ve düşük boy\/çap oranları bu ölçeğin doğal sonucudur/);
    assert.ok(!HTML.includes('olağandışı oranda'), '0031in suçlayıcı dili kalktı');
    assert.ok(!HTML.includes('HATALI VERİ olarak işaretler'));
    assert.ok(!HTML.includes('GEÇİCİDİR'), 'geçici damgası yalnız 🔴 BLOKLUda');
    assert.ok(!HTML.includes('KULLANILMAMALIDIR'));
  });
  test('§5.1 gövde ölçeği notu: model DEĞİŞTİRİLMEDEN çalıştırıldı', () => {
    const i = HTML.indexOf('5.1 Karbon stoku');
    const seg = HTML.slice(i, HTML.indexOf('<h2', i));
    assert.match(seg, /Gövde ölçeği notu:/);
    assert.match(seg, /4\/6 bireyin gövde çapı 100 cm ve üzerindedir/);
    assert.match(seg, /herhangi bir düzeltme\/ölçekleme uygulanmamıştır|DEĞİŞTİRİLMEDEN çalıştırılmış/);
    assert.match(seg, /çevre→çap dönüşümü uygulanmadan/);
  });
  test('§9 sınırlılıklar: anıtsallık + ρ kaynağı + tipik bant sayımı', () => {
    const i9 = HTML.indexOf('<span class="no">9</span>');
    const seg = HTML.slice(i9, HTML.indexOf('<span class="no">10</span>'));
    assert.match(seg, /Anıtsal gövde ölçeği/);
    assert.match(seg, /Sınırlılık veride değil model temsilindedir/);
    assert.match(seg, /Chave ve ark\. 2014/);
    assert.match(seg, /Anıt ağaç TESCİLİ bu raporun konusu değildir/);
    assert.match(seg, /Odun yoğunluğu \(ρ\) kaynağı/);
    assert.match(seg, /P3, P32/);
    assert.match(seg, /GRUP VARSAYILANI ρ ile yeniden üretilmiştir/);
    assert.match(seg, /karbon motoru, katsayılar, saklı değerler ve CSV çıktısı DEĞİŞTİRİLMEMİŞTİR/);
    assert.match(seg, /tipik 15–120 bandının dışındadır; bu bir UYARI DEĞİL, dağılım bilgisidir/);
    assert.match(seg, /medyan 10,24/, 'stand dağılımı sayıyla: ' + (seg.match(/medyan [0-9.,]+/) || [])[0]);
  });
  test('§7 girişi ℹ️ BEYANı tanımlar ve anıtsallığı sayıyla bildirir', () => {
    const i7 = HTML.indexOf('<span class="no">7</span>');
    const seg = HTML.slice(i7, HTML.indexOf('<div class="tscroll">', i7));
    assert.match(seg, /ℹ️ BEYAN/);
    assert.match(seg, /bilgilendirme satırları/);
    assert.match(seg, /kalite hükmü DEĞİLDİR ve rapor durumunu etkilemez/);
    assert.match(seg, /Bu envanterde 4\/6 bireyin gövde çapı 100 cm ve üzerindedir/);
    assert.match(seg, /Bu raporun QA durumu: 🟢 GEÇERLİ/);
  });
  test('boy/çap satırı yeni ölçütü sayıyla beyan eder (fiziksel bant + robust z)', () => {
    const d = rowOf('Boy/DBH oranı incelemesi')[2].txt;
    assert.equal(rowOf('Boy/DBH oranı incelemesi')[1].txt, '✓ Geçerli');
    assert.match(d, /6\/6 kayıt boy\/çap oranı fiziksel makullük bandında \(3–200\)/);
    assert.match(d, /stand içi robust aykırılık testinde aykırı kayıt YOK/);
    assert.match(d, /modified z eşiği 3,5/);
    assert.match(d, /medyan [0-9.,]+, MAD [0-9.,]+, aralık [0-9.,]+–[0-9.,]+, en yüksek \|z\| [0-9.,]+/);
    assert.match(d, /en yüksek \|z\| 1,91/, 'mutlak değer basılır (imza değil): ' + (d.match(/en yüksek \|z\| [-0-9.,]+/) || [])[0]);
    assert.match(d, /6\/6 kayıt tipik 15–120 bandının dışında: bu bir UYARI DEĞİL, BİLGİDİR/);
    assert.match(d, /4 bireyi anıtsal gövde ölçeğinde/);
  });
  test('karbon satırı ρ kaynak sayımını beyan eder', () => {
    const d = rowOf('Karbon yeniden hesabı')[2].txt;
    assert.equal(rowOf('Karbon yeniden hesabı')[1].txt, '✓ Geçerli');
    assert.match(d, /6\/6 kayıt panel denklemiyle \(Chave 2014 \+ kanonik ρ tablosu\) ±%20 içinde yeniden üretildi/);
    assert.match(d, /bant dışı kayıt YOK/);
    assert.match(d, /kayıt tür düzeyi ρ ile eşleşti/);
    assert.match(d, /kayıt grup varsayılanı ρ ile eşleşti/);
    assert.match(d, /GRUP VARSAYILANI ρ ile yeniden üretildi/);
    assert.match(d, /ÖLÇÜM HATASI DEĞİLDİR/);
  });
});

/* =================== 8) metadata.json (makine okunur) =================== */
describe('0032 · metadata.json: monumental + carbonRecalc + qaInfo', () => {
  test('monumental bloğu sayıları ve mevzuatı taşır; tescil hükmü false', () => {
    assert.ok(MD.monumental, 'monumental alanı var');
    assert.equal(MD.monumental.thresholdCm, 100);
    assert.equal(MD.monumental.n, 4);
    assert.equal(MD.monumental.maxDbhCm, 200);
    assert.equal(MD.monumental.isRegistrationDecision, false);
    assert.deepEqual(MD.monumental.diameterBins, [
      { rangeCm: '<50', n: 1 }, { rangeCm: '50–74', n: 1 }, { rangeCm: '100–124', n: 2 },
      { rangeCm: '150–174', n: 1 }, { rangeCm: '200–224', n: 1 },
    ]);
    assert.deepEqual(MD.monumental.points.map((x) => x.pointId), [1, 3, 7, 32]);
    assert.equal(MD.monumental.regulation.rg_sayi, '31898');
    assert.match(MD.monumental.note, /YAPILMAMIŞTIR/);
    assert.match(MD.monumental.note, /Bölge Komisyonu/);
  });
  test('carbonRecalc: ρ kaynağı sayımı + bant + bant dışı noktalar', () => {
    assert.equal(MD.carbonRecalc.bandPct, 20);
    assert.equal(MD.carbonRecalc.minAbsDiffKg, 5);
    assert.equal(MD.carbonRecalc.checked, 6);
    assert.equal(MD.carbonRecalc.matchedSpeciesRho + MD.carbonRecalc.matchedGroupRho, 6);
    assert.deepEqual(MD.carbonRecalc.matchedGroupOnlyPoints, [3, 32]);
    assert.deepEqual(MD.carbonRecalc.outOfBand, []);
    assert.match(MD.carbonRecalc.note, /iki ρ kaynağıyla/);
    assert.match(MD.carbonRecalc.note, /Motor ve katsayılar değişmez/);
  });
  test('qaInfo + qaState: beyan kalemleri durumu değiştirmez', () => {
    assert.deepEqual(MD.qaInfo.map((x) => x.key), ['anit', 'rho-kaynagi']);
    assert.equal(MD.qaState, QA_STATE.VALID);
    assert.equal(MD.qaStateLabel, '🟢 GEÇERLİ');
  });
  test('measurementNote gövde ölçeğini de söyler; DBH tanımı korunur', () => {
    assert.match(MD.measurementNote, /çevre→çap dönüşümü uygulanmadan/);
    assert.match(MD.measurementNote, /Gövde ölçeği: 4\/6 bireyin gövde çapı 100 cm ve üzerindedir/);
    assert.match(MD.measurementNote, /olduğu gibi modellenmiştir/);
    const dbh = MD.variables.find((v) => v.name === 'DBH');
    assert.equal(dbh.unit, 'cm');
    assert.match(dbh.description, /[Gg]öğüs çapı/);
  });
});

/* =================== 9) DOKUNULMAZLAR =================== */
describe('0032 · dokunulmazlar: motor, CSV, şema, migration, yayın kuyruğu, yayımlanmış raporlar', () => {
  test('CSV başlığı ve veri tabanı şeması değişmedi; yeni migration YOK', () => {
    assert.match(read('scripts/make-report.mjs'),
      /const head = 'NOKTA,TUR,GRUP,DBH_CM,BOY_M,KARBON_KG,KARBON_CI_LO_KG,KARBON_CI_HI_KG,ENLEM,BOYLAM,GPS_DOGRULUK_M,TARIH'/);
    const mig = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => /\.sql$/.test(f));
    for (const f of mig) assert.ok(parseInt(f.slice(0, 4), 10) <= 25, '0032 yeni migration EKLEMEMELİ: ' + f);
    assert.ok(!mig.some((f) => /^00(3\d)/.test(f)), 'beklenmeyen migration numarası');
    assert.match(read('supabase/migrations/0001_init_v2_1.sql'), /dbh_cm/i);
  });
  test('yayın kuyruğu ve workflow dosyalarına dokunulmadı', () => {
    const wf = readdirSync(join(ROOT, '.github/workflows'));
    assert.ok(wf.length > 0, 'workflow dosyaları yerinde');
    /* 0032 workflowlara HİÇ dokunmadı: yeni metin/numara izi aranır
     * ("anıtlı"/"kanıtlı" gibi mevcut Türkçe sözcükler yanlış pozitif verir). */
    for (const f of wf) {
      const w = read('.github/workflows/' + f);
      assert.ok(!/Anıtsal gövde|anıtsal gövde beyanı|0032/i.test(w), 'workflow içeriği değişmedi: ' + f);
    }
    assert.ok(!/Anıtsal gövde/.test(read('scripts/publish-queue.mjs')), 'yayın kuyruğu metni değişmedi');
  });
  test('yayımlanmış rapor çıktıları YENİDEN ÜRETİLMEDİ (immutable)', () => {
    const live = 'rapor/DGR-2026-0017/index.html';
    if (existsSync(join(ROOT, live))) {
      const h = read(live);
      assert.ok(!h.includes('Anıtsal gövde beyanı'), 'yayımlanmış rapor 0032 şablonuyla değiştirilmemeli');
      assert.ok(!h.includes('table class="qa"'), 'yayımlanmış rapor markupı olduğu gibi kalmalı');
    }
    /* site sayfaları (index.html) rapor şablonundan etkilenmez */
    assert.ok(!read('index.html').includes('Anıtsal gövde beyanı'));
    assert.ok(!read('sw.js').includes('Anıtsal gövde beyanı'));
  });
  test('rapor sayfası kendi bütünlüğünü doğrular (hash + DG_DATA)', () => {
    assert.match(HTML, /sha256:[0-9a-f]{64}/);
    const d = JSON.parse(HTML.match(/const DG_DATA=(\{[\s\S]*?\});\n/)[1]);
    assert.equal(d.totals.carbon_kg, SUM);
    assert.equal(d.totals.n, ROWS.length);
    assert.deepEqual(d.rows.map((r) => r.dbh_cm), ROWS.map((r) => r.dbh_cm), 'DBH cm olarak aynen taşınır');
  });
  test('üç hâl de aynı SAYILARI basar (QA hükmü sayı değiştirmez)', () => {
    const QA_BAD = {
      ...QA, state: QA_STATE.BLOCKED, dbh_block: true, dbh_review: false,
      dbh_fail: [{ point_id: 1, dbh_cm: null, reason: 'eksik' }, { point_id: 3, dbh_cm: 0, reason: 'pozitif-degil' }, { point_id: 7, dbh_cm: 900, reason: 'aralik-disi' }],
    };
    const QA_WARN = { ...QA, hd_review: true, state: QA_STATE.REVIEW, hd_fail: [{ point_id: 32, hd: 2.1, z: null, reason: 'fiziksel-alt' }] };
    const pick = (h) => {
      const d = JSON.parse(h.match(/const DG_DATA=(\{[\s\S]*?\});\n/)[1]);
      return JSON.stringify({ totals: d.totals, species: d.species, rows: d.rows, mc: d.mc });
    };
    const a = pick(HTML), b = pick(render(QA_WARN, 'DGR-2026-9103').html), c = pick(render(QA_BAD, 'DGR-2026-9104').html);
    assert.equal(b, a, '🟡 = 🟢 sayıları');
    assert.equal(c, a, '🔴 = 🟢 sayıları');
    assert.equal(badge(render(QA_WARN, 'DGR-2026-9105').html), '🟡 İNCELEME');
    assert.equal(badge(render(QA_BAD, 'DGR-2026-9106').html), '🔴 BLOKLU');
  });
});
