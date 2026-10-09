/* form-qa.test.mjs — 0033 BEKÇİSİ: gövde formu ölçütü + KAPSAM (yasal statü
 * iddiası YOK) + Çizelge 4 okunurluğu.
 *
 * 2026-10-01 tarihli veri sahibi kararını kilitler:
 *  "Girdiğimiz veriler gerçek ve doğru. Anıt ağaç detayı işimiz için risk
 *   oluşturabilir; sertifikası bulunmayan ağaçları ölçmüş olabiliriz — bunu
 *   raporda işleme alma. Standartları buna göre güncelle."
 *
 * Bu dosyanın kilitlediği hükümler:
 *  1) KAPSAM: rapor, metadata, QA ve içe aktarma hattı hiçbir birey için yasal
 *     statü (tescil, koruma kararı vb.) iddiası ÜRETMEZ. 0032 ile eklenen eşik
 *     tabanlı gövde sınıfı beyanı, mevzuat künyesi, ℹ️ satırı ve metadata
 *     alanı KALDIRILDI; bu sözcükler rapor metninde HİÇ geçmez.
 *  2) VERİ DOĞRUDUR: gövde çapları sahada ölçüldüğü gibi modellenir; düzeltme,
 *     ölçekleme, dışlama veya çevre→çap dönüşümü YOKTUR. Gövde çapı dağılımı
 *     (dbh_stats) yalnız BETİMLEYİCİ olarak raporlanır.
 *  3) GÖVDE FORMU ÖLÇÜTÜ: sabit 15–120 bandı yerine (i) fiziksel makullük
 *     bandı 3–200 ve (ii) stand İÇİ robust aykırılık (modified z > 3,5).
 *     Tipik bant dışı kayıtlar yalnız SAYILIR (hd_band_out) → uyarı yok.
 *     hd_block KALICI false (0031 korunur).
 *  4) ÇİFT ρ KAYNAĞI: beklenen karbon hem tür düzeyi ρ hem grup varsayılanı ρ
 *     ile hesaplanır; saklı değer herhangi biriyle ±%20 içindeyse satır
 *     geçerlidir ve eşleşen kaynak sayıyla beyan edilir. Gerçek hesap hataları
 *     (10x ondalık kayması) YAKALANMAYA DEVAM EDER.
 *  5) ÇİZELGE 4 DÜZENİ (0032den beri): table.qa + colgroup (sabit kolonlar),
 *     .qd ayrıntı hücresi (orantılı yazı, kelime ortasından kırma YOK), .qst
 *     sonuç hücresi (tek satır, renkli). Masaüstü/mobil/print üçünde tanımlı.
 *  6) DOKUNULMAZLAR: karbon motoru/katsayılar, CSV biçimi, veri tabanı şeması,
 *     migrationlar, yayın kuyruğu ve YAYIMLANMIŞ rapor/ çıktıları DEĞİŞMEZ.
 *     Aynı veri + aynı formül aynı sayıları üretir.
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
  medianOf, madOf, modifiedZ, YASAL_STATU_KAPSAM, MC_CFG,
} from '../scripts/lib/mc.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const dict = loadSpeciesDict();
const _base = loadRho();
const RHO = Object.assign({}, _base.rho);
const GRHO = _base.grho;
const carbonOf = (d, h, sp, gr) => calcRow(d, h, sp, gr).total_carbon;

/* ---------- Göksu benzeri fikstür: geniş gövdeler + FINAL ρ kilidi ---------- */
const RAW = [
  { p: 1, sp: 'SÜS ERİĞİ', grp: 'YAPRAKLI', d: 110, h: 10.2, c: 'tur' },
  { p: 3, sp: 'KIZILAĞAÇ', grp: 'YAPRAKLI', d: 166, h: 14, c: 'grup' },
  { p: 7, sp: 'KARAÇAM', grp: 'İBRELİ', d: 107, h: 12, c: 'tur' },
  { p: 29, sp: 'IHLAMUR', grp: 'YAPRAKLI', d: 40, h: 4.5, c: 'tur' },
  { p: 32, sp: 'KIZILAĞAÇ', grp: 'YAPRAKLI', d: 200, h: 12.5, c: 'grup' },
  { p: 43, sp: 'SIĞLA', grp: 'YAPRAKLI', d: 57, h: 7.5, c: 'tur' },
];
const ROWS = RAW.map((r, i) => ({
  id: 200 + i, point_id: r.p, species: r.sp, grp: r.grp,
  dbh_cm: r.d, girth_cm: null, height_m: r.h,
  carbon_kg: +carbonOf(r.d, r.h, r.sp, r.grp).toFixed(6),
  volume_m3: +calcRow(r.d, r.h, r.sp, r.grp).vol.toFixed(3),
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
describe('0033 · QA eşikleri: 0031 değerleri KORUNDU, form eşikleri aynı, gövde sınıfı eşiği YOK', () => {
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
  test('0032 eşikleri duruyor; 0033 eşik tabanlı gövde sınıfını KALDIRDI', () => {
    assert.equal(QA_LIMITS.HD_PHYS_MIN, 3);
    assert.equal(QA_LIMITS.HD_PHYS_MAX, 200);
    assert.equal(QA_LIMITS.H_MIN_M, 1.3, 'göğüs yüksekliği = ölçülebilen en küçük boy');
    assert.equal(QA_LIMITS.H_MAX_M, 100, 'dünya ağaç boyu rekoru ~100 m');
    assert.equal(QA_LIMITS.HD_ROBUST_Z, 3.5, 'Iglewicz–Hoaglin modified z eşiği');
    assert.equal(QA_LIMITS.HD_ROBUST_MIN_N, 5, 'küçük örneklemden sahte aykırı üretilmez');
    assert.equal(QA_LIMITS.ANIT_DBH_CM, undefined, '0033: eşik tabanlı gövde sınıfı KALDIRILDI');
    assert.deepEqual(Object.keys(QA_LIMITS).filter((k) => /ANIT/i.test(k)), [], 'QA_LIMITS içinde sınıf eşiği yok');
    /* fiziksel bant tipik bandı KAPSAR (tipik bant daha dar) */
    assert.ok(QA_LIMITS.HD_PHYS_MIN < QA_LIMITS.HD_MIN);
    assert.ok(QA_LIMITS.HD_PHYS_MAX > QA_LIMITS.HD_MAX);
  });
  test('hd_block kodda KALICI false (0031 hükmü korunur)', () => {
    assert.match(read('scripts/make-report.mjs'), /out\.hd_block = false;/);
  });
});

/* ============ 2) KAPSAM: yasal statü iddiası ve gövde sınıfı YOK ============ */
describe('0033 · kapsam: yasal statü iddiası, eşik tabanlı gövde sınıfı ve mevzuat atfı YOK', () => {
  /* Yasaklı ifade deseni. \b sınırları, sha256 özetindeki "aad" gibi harf
   * dizilerinin yanlış pozitif üretmesini engeller. */
  const YASAK = /\banıt ağaç|\banıtsal|\bANITSAL|\bmonumental\b|\bEk-4\b|\b31898\b|İlke Kararı|Bölge Komisyonu|\bŞAD\b|\bAAD\b/gi;
  const bul = (t) => String(t).match(YASAK) || [];
  const temiz = (dosya) => assert.deepEqual(bul(read(dosya)), [], dosya + ' yasaklı ifade içeriyor');

  test('mc.mjs: sınıf eşiği, mevzuat künyesi ve basamak tablosu kaldırıldı', () => {
    assert.equal(QA_LIMITS.ANIT_DBH_CM, undefined);
    temiz('scripts/lib/mc.mjs');
    const src = read('scripts/lib/mc.mjs');
    for (const ad of ['ANIT_MEVZUAT', 'ANIT_GOVDE_BASAMAKLARI', 'anitGovdeBasamagi']) {
      assert.ok(!src.includes('export const ' + ad), ad + ' sabiti yok');
      assert.ok(!src.includes('export function ' + ad), ad + ' fonksiyonu yok');
    }
  });

  test('kapsam beyanı TEK KAYNAKTAN gelir: mc.YASAL_STATU_KAPSAM', () => {
    assert.match(YASAL_STATU_KAPSAM, /yasal statü değerlendirmesi/);
    assert.match(YASAL_STATU_KAPSAM, /içermez/);
    assert.match(YASAL_STATU_KAPSAM, /ilgili idarenin yetkisindedir/);
    assert.match(YASAL_STATU_KAPSAM, /kapsamı dışındadır/);
    assert.match(YASAL_STATU_KAPSAM, /gövde çevresi ölçülmüş/);
    assert.match(YASAL_STATU_KAPSAM, /DBH çapı çevre\/π ile türetilmiş/);
    assert.deepEqual(bul(YASAL_STATU_KAPSAM), [], 'beyan metni de yasaklı sözcük içermez');
    /* tek kaynak: rapor hem §9da hem metadatada aynı sabiti kullanır */
    assert.match(read('scripts/make-report.mjs'), /^    YASAL_STATU_KAPSAM,$/m);
    assert.match(read('scripts/make-report.mjs'), /legalStatusScope: YASAL_STATU_KAPSAM,/);
    assert.match(read('scripts/lib/report-metadata.mjs'), /scopeNote: legalStatusScope,/);
  });

  test('üretilen rapor HTMLi ve metadata.json yasaklı ifade İÇERMEZ', () => {
    assert.deepEqual(bul(HTML), [], 'HTML: ' + JSON.stringify(bul(HTML).slice(0, 5)));
    assert.deepEqual(bul(JSON.stringify(MD)), [], 'metadata: ' + JSON.stringify(bul(JSON.stringify(MD)).slice(0, 5)));
    assert.ok(!HTML.includes('Anıtsal gövde beyanı'), 'Çizelge 4te beyan satırı yok');
    assert.equal(rowOf('Anıtsal gövde beyanı'), undefined);
    assert.equal(MD.monumental, undefined, 'metadata.monumental kaldırıldı');
    assert.equal(MD.scopeNote, YASAL_STATU_KAPSAM);
  });

  test('rapor şablonu, içe aktarma hattı ve dokümanlar da temiz', () => {
    for (const f of ['scripts/make-report.mjs', 'scripts/import-measurements.mjs', 'docs/methods.md', 'docs/rapor-yayini.md']) temiz(f);
  });

  test('QA mantığı eşikten BAĞIMSIZ: 99 cm ile 200 cm aynı muameleyi görür', () => {
    const mk = (i, d) => ({ id: i, point_id: i, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: d, height_m: 12, carbon_kg: null });
    const alt = inventoryQa([1, 2, 3, 4, 5].map((i) => mk(i, 90 + i)), dict);
    const ust = inventoryQa([1, 2, 3, 4, 5].map((i) => mk(i, 190 + i)), dict);
    for (const qa of [alt, ust]) {
      assert.deepEqual(Object.keys(qa).filter((k) => /anit/i.test(k)), [], 'QA çıktısında sınıf alanı yok');
      assert.deepEqual(qa.info, [], 'ℹ️ beyan kalemi üretilmiyor');
      assert.equal(qa.dbh_fail.length, 0);
    }
    assert.equal(alt.state, ust.state, 'eşik atlaması durum DEĞİŞTİRMEZ');
    assert.equal(ust.dbh_stats.min, 191);
    assert.equal(ust.dbh_stats.max, 195);
    assert.equal(alt.dbh_stats.max, 95);
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

/* ================== 4) FINAL ρ KİLİDİ (karbon denetimi) ================== */
describe('karbon yeniden hesabı yalnız FINAL kilitli ρ ile yapılır', () => {
  const mk = (p, sp, grp, d, h, c) => ({ id:p, point_id:p, species:sp, grp, dbh_cm:d, height_m:h, carbon_kg:c });

  test('özel tür ρ dışarıdan grup geneliyle override edilemez', () => {
    const d=166,h=14;
    const finalC=carbonOf(d,h,'KIZILAĞAÇ','YAPRAKLI');
    const injected=calcRow(d,h,'KIZILAĞAÇ','YAPRAKLI',{rho:{},grho:{YAPRAKLI:541}}).total_carbon;
    assert.equal(injected,finalC,'dış politika FINAL kilidi değiştirememeli');
    const qa=inventoryQa([mk(3,'KIZILAĞAÇ','YAPRAKLI',d,h,+finalC.toFixed(6))],dict);
    assert.equal(qa.dev_fail.length,0);
    assert.equal(qa.rows[0].rho_src,'tur');
    assert.equal(qa.rows[0].rho_species,407);
    assert.deepEqual(qa.dev_rho.grup_farkli,[]);
    assert.equal(qa.state,QA_STATE.VALID);
  });

  test('gerçek hesap hatası (10x ondalık kayması) yakalanır; alternatif ρ aranmaz', () => {
    const d=107,h=12,dogru=carbonOf(d,h,'KARAÇAM','İBRELİ');
    const qa=inventoryQa([mk(7,'KARAÇAM','İBRELİ',d,h,+(dogru/10).toFixed(1))],dict);
    assert.equal(qa.dev_fail.length,1);
    assert.equal(qa.dev_fail[0].point_id,7);
    assert.ok(Math.abs(qa.dev_fail[0].dev_pct)>80);
    assert.equal(qa.dev_fail[0].expected_grp,null);
    assert.equal(qa.rows[0].rho_src,'tur');
  });

  test('küçük kayıtlarda mutlak taban (≥5 kg) korunur', () => {
    const r=[mk(29,'IHLAMUR','YAPRAKLI',12.73,4.5,10.6)];
    const qa=inventoryQa(r,dict);
    assert.equal(qa.rows[0].dev_fail,false);
    assert.equal(qa.dev_fail.length,0);
  });

  test('yetkili kaynak sayımı tür-özel / grup-geneli olarak beyan edilir', () => {
    assert.equal(QA.dev_rho.n,6);
    assert.equal(QA.dev_rho.tur,3);
    assert.equal(QA.dev_rho.grup,3);
    assert.deepEqual(QA.dev_rho.grup_farkli,[]);
    assert.equal(QA.dev_fail.length,0);
    assert.equal(QA.dev_block,false);
  });

  test('karbon motoru aynı Chave/BGB/C katsayılarını korur', () => {
    const altin=calcRow(107,12,'KARAÇAM','İBRELİ');
    assert.ok(Math.abs(altin.total_carbon-1972.827017)<1e-4,'altın değer: '+altin.total_carbon);
    assert.ok(Math.abs(altin.bhb-altin.agb*0.26)<1e-9);
    assert.ok(Math.abs(altin.total_carbon-(altin.agb+altin.bhb)*0.47)<1e-9);
    for(const k of ['0.0673','0.976','0.26','0.47']){
      assert.ok(read('scripts/lib/mc.mjs').includes(k),'mc.mjs: '+k);
      assert.ok(read('src/domain/trees/allometry.js').includes(k),'domain allometry: '+k);
    }
    assert.doesNotMatch(read('src/services/allometry.js'),/0\.0673|0\.976|0\.26|0\.47/);
  });
});

/* ================ 5) GÖVDE FORMU + ÇAP DAĞILIMI (0033) ================ */
describe('0033 · inventoryQa: çap dağılımı betimleyici, form göstergesi iki katmanlı', () => {
  test('dbh_stats VERİDEN türetilir; eşik, sınıf, basamak alanı YOK', () => {
    assert.deepEqual(QA.dbh_stats, { n: 6, min: 40, medyan: 108.5, max: 200 });
    assert.equal(QA.anit, undefined, '0032 alanı kaldırıldı');
    assert.deepEqual(Object.keys(QA).filter((k) => /anit|basamak|mevzuat|threshold/i.test(k)), []);
    const p3 = QA.rows.find((r) => r.point_id === 3);
    assert.deepEqual(Object.keys(p3).filter((k) => /anit|basamak/i.test(k)), [], 'satır düzeyinde sınıf alanı yok');
  });

  test('alternatif ρ beyan kalemi yoktur; QA durumu geçerlidir', () => {
    assert.deepEqual(QA.info, []);
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

  test('satır düzeyi alanlar: hd_band_out / hd_z / rho_src (çap olduğu gibi)', () => {
    const p3 = QA.rows.find((r) => r.point_id === 3);
    assert.equal(p3.hd_band_out, true);
    assert.equal(p3.hd_fail, false);
    assert.equal(p3.rho_src, 'tur');
    assert.equal(p3.dbh_cm, 166, 'DBH olduğu gibi: dönüşüm YOK');
    assert.equal(p3.dbh_fail, false);
    assert.equal(QA.rows.find((r) => r.point_id === 29).dbh_cm, 40);
  });

  test('küçük çaplı envanterde de beyan satırı ÜRETİLMEZ (Çizelge 4 16 satır)', () => {
    const kucuk = [1, 2, 3, 4, 5].map((i) => ({ id: i, point_id: i, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 30 + i, height_m: 12, carbon_kg: null }));
    const qa = inventoryQa(kucuk, dict);
    assert.deepEqual(qa.info, [], 'beyan kalemi yok');
    assert.deepEqual(qa.dbh_stats, { n: 5, min: 31, medyan: 33, max: 35 });
    const h = render(qa, 'DGR-2026-9102').html;
    assert.ok(!h.includes('Anıtsal gövde beyanı'), 'satır hiçbir envanterde basılmaz');
    const tbl = qaTable(h);
    assert.equal(tbl.length, 17, 'başlık + 16 kontrol satırı: ' + tbl.map((r) => r[0] && r[0].txt).join(' | '));
    assert.ok(!tbl.some((r) => r[0] && /gövde/i.test(r[0].txt)), 'Çizelge 4te gövde sınıfı satırı yok');
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
  test('sonuç hücreleri renkli durum sınıflarını taşır (qok / qwarn / qbad)', () => {
    const sonuclar = QA_TBL.slice(1).map((r) => r[1]);
    assert.ok(sonuclar.filter((c) => /qok/.test(c.attr)).length >= 10, '✓ Geçerli hücreleri: ' + sonuclar.length);
    /* 0033: ℹ️ beyan satırı üretilmiyor; .qinfo sınıfı CSSde TANIMLI kalır
     * (ileride bilgilendirme satırı eklenirse düzen hazır). */
    assert.ok(!QA_TBL.some((r) => r[1] && r[1].txt.startsWith('ℹ')), 'bu raporda ℹ️ satırı yok');
    assert.match(HTML, /td\.qinfo\{color:#1c5d8f/);
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

/* =================== 7) RAPOR METNİ BEYANLARI (0033) =================== */
describe('0033 · rapor metni: yasal statü iddiası YOK, veri hatası iması YOK', () => {
  const bol = (bas, son) => {
    const i = HTML.indexOf(bas);
    assert.ok(i > 0, bas + ' bulunamadı');
    return HTML.slice(i, son ? HTML.indexOf(son, i) : i + 2000);
  };
  const S9 = stripTags(bol('<span class="no">9</span>', '<span class="no">10</span>'));
  const S7 = stripTags(bol('<span class="no">7</span>', '<div class="tscroll">'));
  const S51 = stripTags(bol('5.1 Karbon stoku', '<h2'));

  test('Çizelge 4te gövde sınıfı satırı yok; ağaç değeri kontrolleri ✓ Geçerli', () => {
    assert.equal(rowOf('Anıtsal gövde beyanı'), undefined);
    for (const ad of ['Ölçüm protokolü (çevre → DBH)', 'Boy/DBH oranı incelemesi', 'Karbon yeniden hesabı']) {
      const r = rowOf(ad);
      assert.ok(r, ad + ' satırı var');
      assert.equal(r[1].txt, '✓ Geçerli', ad + ' → ' + r[1].txt);
    }
  });

  test('§9 kapsam beyanı birebir yer alır (tek kaynak sabiti)', () => {
    assert.ok(S9.includes(YASAL_STATU_KAPSAM), 'kapsam beyanı §9da yok');
    assert.match(S9, /yasal statü değerlendirmesi/);
    assert.match(S9, /ilgili idarenin yetkisindedir/);
  });

  test('§9 model temsili: çap aralığı VERİDEN, sınırlılık modelde', () => {
    assert.match(S9, /Gövde çapı dağılımı ve model temsili/);
    assert.match(S9, /40,0–200,0 cm \(medyan 108,5 cm, n=6\)/);
    assert.match(S9, /Modelin aktarılabilirliği şu sınırlamalara tabidir/);
    assert.match(S9, /Chave ve ark\. 2014/);
    assert.match(S9, /model sapmasını ayrıca nicelleştirmez/);
    assert.match(S9, /Ham çevre değiştirilmemiş; allometriye yalnız yuvarlanmamış türetilmiş D uygulanmıştır/);
  });

  test('§9 tipik bant sayımı korunur; alternatif ρ sınırlılığı yoktur', () => {
    assert.ok(!/HER İKİ ρ|iki ρ kaynağı|GRUP VARSAYILANI ρ ile yeniden üretilmiştir/.test(S9));
    assert.match(S9, /tipik 15–120 bandının dışındadır; bu bir UYARI DEĞİL, dağılım bilgisidir/);
    assert.match(S9, /medyan 10,24/, 'stand dağılımı sayıyla');
    assert.match(S9, /tek başına ölçüm hatası kanıtı oluşturmaz/);
  });

  test('veri hatası iması YOK: suçlayıcı dil kalıcı olarak kaldırıldı', () => {
    assert.ok(!HTML.includes('olağandışı oranda'), '0031in suçlayıcı dili kalktı');
    assert.ok(!HTML.includes('HATALI VERİ olarak işaretler'));
    assert.ok(!HTML.includes('GEÇİCİDİR'), 'geçici damgası yalnız 🔴 BLOKLUda');
    assert.ok(!HTML.includes('KULLANILMAMALIDIR'));
    assert.ok(!/[Ss]tandart dışı/.test(HTML), 'değerler standart dışı diye damgalanmaz');
  });

  test('§5.1 ölçüm notu: ham çevre ve türetilmiş DBH ayrımı açık', () => {
    assert.match(S51, /Ölçüm notu:/);
    assert.match(S51, /Ham saha değişkeni göğüs çevresidir/);
    assert.match(S51, /DBH = çevre \/ π/);
    assert.match(S51, /Türetilmiş DBH aralığı:/);
  });

  test('§7 girişi: ℹ️ cümlesi YALNIZ beyan satırı varsa basılır', () => {
    assert.ok(!S7.includes('ℹ️ BEYAN'), 'bu raporda ℹ️ satırı yok → cümle de basılmaz');
    assert.match(S7, /Bu raporun QA durumu: 🟢 GEÇERLİ/);
    assert.match(S7, /sahada ölçülen göğüs çevresinden D=C\/π ile türetilen yuvarlanmamış DBH/);
    assert.match(S7, /DBH 1 ondalık basamakla gösterilir/);
  });

  test('boy/çap satırı ölçütü sayıyla beyan eder (fiziksel bant + robust z)', () => {
    const d = rowOf('Boy/DBH oranı incelemesi')[2].txt;
    assert.equal(rowOf('Boy/DBH oranı incelemesi')[1].txt, '✓ Geçerli');
    assert.match(d, /6\/6 kayıt boy\/çap oranı fiziksel makullük bandında \(3–200\)/);
    assert.match(d, /stand içi robust aykırılık testinde aykırı kayıt YOK/);
    assert.match(d, /modified z eşiği 3,5/);
    assert.match(d, /medyan [0-9.,]+, MAD [0-9.,]+, aralık [0-9.,]+–[0-9.,]+, en yüksek \|z\| [0-9.,]+/);
    assert.match(d, /en yüksek \|z\| 1,91/, 'mutlak değer basılır (imza değil)');
    assert.match(d, /6\/6 kayıt tipik 15–120 bandının dışında: bu bir UYARI DEĞİL, BİLGİDİR/);
    assert.match(d, /türetilmiş DBH aralığı 40,0–200,0 cm/);
    assert.deepEqual(d.match(/anıt|Anıt/g) || [], [], 'satır metninde iz yok');
  });

  test('karbon satırı FINAL kilit ve yetkili kaynak sayımını beyan eder', () => {
    const d=rowOf('Karbon yeniden hesabı')[2].txt;
    assert.equal(rowOf('Karbon yeniden hesabı')[1].txt,'✓ Geçerli');
    assert.match(d,/6\/6 kayıt panel denklemiyle \(Chave 2014 \+ FINAL kilitli ρ tablosu\) ±%20 içinde yeniden üretildi/);
    assert.match(d,/bant dışı kayıt YOK/);
    assert.match(d,/3 kayıt kilitli tür ρ satırı kullandı/);
    assert.match(d,/3 kayıt yalnız kendi grup genelini kullandı/);
    assert.ok(!/HER İKİ ρ|iki ρ kaynağı/.test(d));
  });
});

/* =================== 8) metadata.json (makine okunur) =================== */
describe('0033 · metadata.json: scopeNote + carbonRecalc + qaInfo', () => {
  test('eşik tabanlı gövde sınıfı alanı KALDIRILDI; yerine scopeNote', () => {
    assert.equal(MD.monumental, undefined);
    assert.equal(MD.scopeNote, YASAL_STATU_KAPSAM);
    const t = JSON.stringify(MD);
    for (const iz of ['monumental', 'diameterBins', 'thresholdCm', 'isRegistrationDecision', 'anıtsal', 'Anıtsal', '31898', 'Ek-4', 'İlke Kararı']) {
      assert.ok(!t.includes(iz), 'metadata içinde iz kalmadı: ' + iz);
    }
  });
  test('carbonRecalc: ρ kaynağı sayımı + bant + bant dışı noktalar', () => {
    assert.equal(MD.carbonRecalc.bandPct, 20);
    assert.equal(MD.carbonRecalc.minAbsDiffKg, 5);
    assert.equal(MD.carbonRecalc.checked, 6);
    assert.equal(MD.carbonRecalc.matchedSpeciesRho + MD.carbonRecalc.matchedGroupRho, 6);
    assert.deepEqual(MD.carbonRecalc.matchedGroupOnlyPoints, []);
    assert.deepEqual(MD.carbonRecalc.outOfBand, []);
    assert.match(MD.carbonRecalc.note, /yalnız FINAL kilitli ρ tablosuyla/);
    assert.equal(MD.carbonRecalc.densityLockId, 'DG-WD-LOCK-2026-10-06-FINAL');
  });
  test('qaInfo + qaState: beyan kalemleri durumu değiştirmez', () => {
    assert.deepEqual(MD.qaInfo, [], 'alternatif ρ bilgi kalemi yok');
    assert.equal(MD.qaState, QA_STATE.VALID);
    assert.equal(MD.qaStateLabel, '🟢 GEÇERLİ');
  });
  test('measurementNote: ham çevre + türetilmiş DBH protokolü', () => {
    assert.match(MD.measurementNote, /göğüs çevresi/);
    assert.match(MD.measurementNote, /DBH çapı D = C \/ pi/);
    assert.ok(!/anıt|Anıt/.test(MD.measurementNote), 'ölçüm notunda iz yok');
    const girth=MD.variables.find((v)=>v.name==='Göğüs çevresi (C)');
    const dbh=MD.variables.find((v)=>v.name==='DBH (D)');
    assert.equal(girth.unit,'cm'); assert.equal(dbh.unit,'cm');
    assert.match(dbh.description,/D = C \/ pi/);
  });
});

/* =================== 9) DOKUNULMAZLAR =================== */
describe('0033 · dokunulmazlar: motor, CSV, şema, migration, yayın kuyruğu, yayımlanmış raporlar', () => {
  test('CSV başlığı ve veri tabanı şeması değişmedi; yeni migration YOK', () => {
    assert.match(read('scripts/make-report.mjs'),
      /const head = 'NOKTA,TUR,GRUP,GOGUS_CEVRESI_CM,DBH_CM,BOY_M,KARBON_KG,KARBON_CI_LO_KG,KARBON_CI_HI_KG,ENLEM,BOYLAM,GPS_DOGRULUK_M,TARIH'/);
    const mig = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => /\.sql$/.test(f));
    for (const f of mig) assert.ok((parseInt(f.slice(0, 4), 10) <= 25 || ["20261003165331_surface_reviews.sql","20261003180749_surface_report_snapshot.sql","20261003203000_report_accepted_surface_snapshot.sql","20261003220749_surface_geometry_compat.sql","20261004165219_profile_privilege_guard.sql","20261006193500_data_requests_delete_own.sql","20261007083413_report_access_hardening.sql","20261007083543_rls_index_optimization.sql"].includes(f)), '0033 yeni migration EKLEMEMELİ: ' + f);
    assert.ok(!mig.some((f) => /^00(3\d)/.test(f)), 'beklenmeyen migration numarası');
    assert.ok(!/alter\s+table\s+(?:public\.)?(?:measurements|projects|parks)/i.test(read('supabase/migrations/20261003165331_surface_reviews.sql')), 'yüzey kaydı ölçüm/park şemasını değiştirmez');
    const reqMig=read('supabase/migrations/20261006193500_data_requests_delete_own.sql');
    assert.match(reqMig,/on public\.data_requests[\s\S]*for delete/i,'yeni migration yalnız veri talepleri DELETE RLS içindir');
    assert.ok(!/(?:measurements|projects|parks|dbh_cm|carbon_kg)/i.test(reqMig),'veri talebi RLS migrationı bilimsel şemaya dokunmaz');
    assert.match(read('supabase/migrations/0001_init_v2_1.sql'), /dbh_cm/i);
  });
  test('yayın kuyruğu ve workflow dosyalarına dokunulmadı', () => {
    const wf = readdirSync(join(ROOT, '.github/workflows'));
    assert.ok(wf.length > 0, 'workflow dosyaları yerinde');
    /* 0033 workflowlara HİÇ dokunmadı: yeni metin/numara izi aranır
     * ("kanıtlı" gibi mevcut Türkçe sözcükler yanlış pozitif verir). */
    for (const f of wf) {
      const w = read('.github/workflows/' + f);
      assert.ok(!/scopeNote|YASAL_STATU|0033/i.test(w), 'workflow içeriği değişmedi: ' + f);
    }
    assert.ok(!/YASAL_STATU_KAPSAM/.test(read('scripts/publish-queue.mjs')), 'yayın kuyruğu metni değişmedi');
  });
  test('yayımlanmış rapor çıktıları YENİDEN ÜRETİLMEDİ (immutable)', () => {
    /* 0017 geri çekildi (bildirim sayfası), 0018 0032 şablonuyla yayında.
     * 0033 yayımlanmış çıktıları DEĞİŞTİRMEZ: düzeltme YENİ raporla yapılır,
     * eski rapor yayın panelinden geri çekilir. Bu yüzden 0018in içeriğine
     * dokunulmadığı aşağıda DOĞRULANIR (içerdiği 0032 metni silinmez). */
    const cekilen = 'rapor/DGR-2026-0017/index.html';
    if (existsSync(join(ROOT, cekilen))) {
      assert.match(read(cekilen), /geri çekilmiştir|Test yayını arşivlendi/i);
      assert.ok(!read(cekilen).includes('table class="qa"'), 'geri çekme bildirimi rapor şablonu değildir');
    }
    const yayinda = 'rapor/DGR-2026-0018/index.html';
    if (existsSync(join(ROOT, yayinda))) {
      const h = read(yayinda);
      assert.match(h, /DGR-2026-0018/);
      assert.ok(!h.includes('scopeNote'), '0018, 0033 şablonuyla yeniden ÜRETİLMEDİ');
    }
    /* site sayfaları (index.html, sw.js) rapor şablonundan etkilenmez */
    assert.ok(!read('index.html').includes('scopeNote'));
    assert.ok(!read('sw.js').includes('scopeNote'));
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
