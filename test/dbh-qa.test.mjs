/* dbh-qa.test.mjs — 0031 BEKÇİSİ: DBH = göğüs çapı (cm), dönüşüm YOK.
 *
 * Bu dosya 2026-09-29 tarihli veri sahibi kararını (DGR-2026-0016 düzeltilmiş
 * geliştirme ve kalite kontrol planı, 18 madde) kilitler:
 *
 *  1) DBH, göğüs yüksekliğinde (1,30 m) ölçülen gövde ÇAPIdır; birimi cmdir
 *     ve sahada doğrudan kaydedilir. Rapor hattının HİÇBİR yerinde
 *     çevre→çap (÷π) dönüşümü yoktur ve raporda böyle bir iddia geçmez.
 *  2) Karbon motoru, katsayılar, MC yapılandırması, CSV biçimi ve veri
 *     tabanı şeması DEĞİŞMEZ: aynı veri + aynı formül aynı sayıları üretir.
 *     QA hükmü (🟢/🟡/🔴) değiştiğinde bile tek bir sayı oynamaz.
 *  3) Boy/DBH oranı yalnız İNCELEME göstergesidir; hd_block kalıcı false.
 *     Gerçek saha verisi bu gerekçeyle bloklanamaz.
 *  4) Yanlış QA hükümleri ("DBH = çevre ÷ π", "sistemik birim hatası",
 *     "⛔ Blok", "GEÇİCİDİR / KULLANILMAMALIDIR") rapor metninden kalktı.
 *  5) Rapor durumu üç hâllidir: 🔴 BLOKLU / 🟡 İNCELEME / 🟢 GEÇERLİ ve
 *     Çizelge 4ten türetilir (künyede sabit "Geçerli" yazmaz).
 *  6) Veri sözlüğü (§4.6) + Ölçüm notu rapor ve metadata.json içindedir.
 *
 * Bu test yayımlanmış rapor/ çıktılarına BAĞIMLI DEĞİLDİR (yayımlanan
 * raporlar geri çekilebilir); kendi gerçekçi fikstürünü üretir ve
 * sayıları karbon motorundan türetir.
 *
 * Not: Türkçe metinlerde kesme işareti kullanılmıyor; dosya tek tırnaklı
 * dizeler içerdiği için apostrof sözdizimini bozuyor.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, inventoryQa, buildMetadata } from '../scripts/make-report.mjs';
import { canonicalHash, loadSpeciesDict, loadRho, calcRow, QA_LIMITS, QA_STATE, qaStateOf, DBH_REASON_TR, MC_CFG } from '../scripts/lib/mc.mjs';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const dict = loadSpeciesDict();

/* ---- ρ tablosu: inventoryQa ile birebir aynı öncelik (kanonik sözlük ρsu) ---- */
const _base = loadRho();
const RHO = Object.assign({}, _base.rho);
for (const e of Object.values(dict.byName)) if (e.rho) RHO[e.tr] = e.rho;
const GRHO = _base.grho;
const carbonOf = (d, h, sp, gr) => calcRow(d, h, sp, gr, { rho: RHO, grho: GRHO }).total_carbon;

/* ---------- sentetik ama GERÇEKÇİ envanter (DBH = göğüs çapı, cm) ----------
 * Saklı karbon değerleri panel denkleminden türetilir → karbon yeniden hesap
 * kontrolü temiz çıkar; böylece testler YALNIZ 0031in konusu olan eksenleri
 * (DBH geçerliliği, boy/çap göstergesi, durum rozeti) ölçer.
 * P1/P7/P29 gövde oranı gösterge aralığı dışında (gerçek Göksu deseni),
 * P50/P51/P52 aralık içinde → karma bir örneklem. */
const RAW = [
  { point_id: 1, species: 'SÜS ERİĞİ', grp: 'YAPRAKLI', dbh_cm: 110, height_m: 10.2, lat: 39.99025, lon: 32.65201 },
  { point_id: 7, species: 'KARAÇAM', grp: 'İBRELİ', dbh_cm: 107, height_m: 12, lat: 39.99111, lon: 32.65332 },
  { point_id: 29, species: 'IHLAMUR', grp: 'YAPRAKLI', dbh_cm: 40, height_m: 4.5, lat: 39.99222, lon: 32.65443 },
  { point_id: 50, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 45, height_m: 15, lat: 39.99050, lon: 32.65100 },
  { point_id: 51, species: 'SEDİR', grp: 'İBRELİ', dbh_cm: 60, height_m: 18, lat: 39.99080, lon: 32.65150 },
  { point_id: 52, species: 'ÇINAR', grp: 'YAPRAKLI', dbh_cm: 90, height_m: 20, lat: 39.99100, lon: 32.65180 },
];
const ROWS = RAW.map((r, i) => ({
  id: 100 + i, point_id: r.point_id, species: r.species, grp: r.grp,
  dbh_cm: r.dbh_cm, girth_cm: null, height_m: r.height_m,
  carbon_kg: +carbonOf(r.dbh_cm, r.height_m, r.species, r.grp).toFixed(6),
  volume_m3: +calcRow(r.dbh_cm, r.height_m, r.species, r.grp, { rho: RHO, grho: GRHO }).vol.toFixed(3),
  lat: r.lat, lon: r.lon, acc_m: 4.2, photo: true, photo_file: `P${String(r.point_id).padStart(3, '0')}_M1.JPG`, date: '2026-09-28',
}));
const SUM = +ROWS.reduce((a, r) => a + r.carbon_kg, 0).toFixed(2);
const PARK_M2 = 501107; /* Göksu Parkı (park 25) gerçek alanı */
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
  generated_at: '2026-09-30T09:00:00.000Z',
  mc: { ...MC_CFG },
  totals: { n: ROWS.length, carbon_kg: SUM, ci: { mean: SUM, lo: +(SUM * 0.55).toFixed(2), hi: +(SUM * 1.41).toFixed(2) }, per_ha_kg: +((SUM * 10000) / PARK_M2).toFixed(2) },
  species: SPECIES,
  gps: { n: ROWS.length, n_with_acc: ROWS.length, n_null_acc: 0, mean_acc_m: 4.2 },
  period: { from: '2026-09-28T09:00:00Z', to: '2026-09-28T15:00:00Z' },
  moderation: { approved: ROWS.length, reviewed: ROWS.length },
  geofence: { policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)', total: ROWS.length, verified_rows: ROWS.length, outside_rows: 0, polygon_source: 'OSM' },
  geometry_qa: { source: 'OSM way/423602737', ring_points: 111, ring_area_m2: 500000, self_intersections: 0 },
  provenance: { engine: 'DendroGeo LC Engine', engine_version: '4.2.0', app_version: '3.0.0', git_commit: 'abc1234def5678', report_id: 'DGR-2026-9001', epsg: 32636, resolution_m: 10, dataset: 'ESA WorldCover 10 m · 2021 (v200)' },
  lulc: {
    source: 'ESA WorldCover 10 m · 2021 (v200)', citation: 'ESA WorldCover 10 m 2021 v200, CC BY 4.0', year: 2021,
    cross: 'IO LULC', crossError: null, agreement: { green: { agreementPct: 91 }, hard: { agreementPct: 84 } },
    areaDeltaPct: 0.059, cells: 5020, coverage_m2: 501200, classified_m2: 501200, epsg: 32636, masked_ha: 0,
    classes: [
      { key: 'green', label: 'Yeşil alan', ha: 41.1, pct: 82 },
      { key: 'hard', label: 'Sert yüzey', ha: 6.0, pct: 12 },
      { key: 'water', label: 'Su', ha: 3.0, pct: 6 },
    ],
  },
  rows: ROWS,
};

/* ---- QA katmanı: 0033 (QA v5) koduyla hesaplanır + üç hâlin enjekte hâlleri ----
 * 0033 · bu fikstürde ağaç DEĞERİ kontrollerinin tümü geçerlidir (ölçülen
 * gövde çapı 40–110 cm; karbon motor değerlerinden türetildi)
 * → doğal durum 🟢 GEÇERLİ. 🟡 İNCELEME ve 🔴 BLOKLU görünümleri AYNI
 * snapshot üzerine enjekte edilen QA nesneleriyle doğrulanır: amaç, QA hükmü
 * değişirken SAYILARIN (çizelgeler, toplam, GA, t/ha, DG_DATA) değişmediğini
 * kanıtlamak. Enjekte hd_fail kayıtları 0032 ölçütlerinin gerçek biçimidir:
 * reason 'fiziksel-alt' (h/D < 3) veya 'stand-aykiri' (modified z > 3,5). */
const QA = inventoryQa(SNAP.rows, dict);
const QA_REVIEW = {
  ...QA, hd_review: true, state: QA_STATE.REVIEW,
  hd_fail: [
    { point_id: 1, hd: 9.27, z: 4.1, reason: 'stand-aykiri' },
    { point_id: 7, hd: 2.1, z: null, reason: 'fiziksel-alt' },
    { point_id: 29, hd: 11.25, z: 3.9, reason: 'stand-aykiri' },
  ],
};
const QA_VALID = { ...QA, hd_fail: [], hd_review: false, state: QA_STATE.VALID };
const QA_BLOCKED = {
  ...QA, state: QA_STATE.BLOCKED, dbh_block: true, dbh_review: false,
  dbh_fail: [{ point_id: 1, dbh_cm: null, reason: 'eksik' }, { point_id: 7, dbh_cm: 0, reason: 'pozitif-degil' }, { point_id: 29, dbh_cm: 900, reason: 'aralik-disi' }],
};
const META = { id: 'DGR-2026-9001', git_commit: 'abc1234def5678', engine_version: '4.2.0', app_version: '3.0.0', epsg: 32636, resolution_m: 10, dataset: SNAP.lulc.source, history: [{ id: 'DGR-2026-9000', date: '2026-09-27', retracted: true, note: 'Aynı parkın önceki analizi (geri çekildi)' }] };
const render = (qa, id = 'DGR-2026-9001') => {
  const s = { ...SNAP, qa: { species: qa, photos: { n_with: ROWS.length, n: ROWS.length } } };
  const hash = canonicalHash(s);
  return { html: renderReport(s, { id, hash, version: 1, meta: { ...META, id } }), md: buildMetadata(s, { id, hash, version: '1.0', meta: { ...META, id }, history: META.history }), snap: s, hash };
};
const R = render(QA_REVIEW);     /* 🟡 İNCELEME (enjekte: gövde formu incelemesi) */
const HTML = R.html, MD = R.md;
const R_OK = render(QA_VALID);   /* 🟢 GEÇERLİ (0032de doğal durum da bu) */
const R_BAD = render(QA_BLOCKED);/* 🔴 BLOKLU */

/* ---- yardımcılar ---- */
const stripTags = (x) => x.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const tables = (h) => {
  const out = new Map();
  for (const m of h.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const body = m[1];
    const head = [...body.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((x) => stripTags(x[1])).join('|');
    const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .map((r) => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => stripTags(c[1])).join('¦'));
    out.set(head, rows);
  }
  return out;
};
const ciText = (h) => { const m = h.match(/<div class="ci">([\s\S]*?)<\/div>/); return m ? stripTags(m[1]) : null; };
const dgData = (h) => JSON.parse(h.match(/const DG_DATA=(\{[\s\S]*?\});\n/)[1]);
const badge = (h) => (h.match(/<b>Rapor durumu<\/b><span class="([^"]*)">([^<]*)<\/span>/) || [])[2];
/* src/ ve scripts/ altındaki tüm .js/.mjs dosyaları (vendor/node_modules hariç). */
const codeFiles = () => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'vendor' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.m?js$/.test(e.name)) out.push(p);
    }
  };
  walk('src'); walk('scripts');
  return out;
};

describe('0031 · karbon motoru DEĞİŞMEDİ (aynı formül, aynı katsayılar)', () => {
  test('katsayılar mc.mjs, panel allometry.js ve rapor metninde birebir aynı', () => {
    const mc = read('scripts/lib/mc.mjs');
    const panel = read('src/services/allometry.js');
    for (const k of ['0.0673', '0.976', '0.26', '0.47']) {
      assert.ok(mc.includes(k), 'mc.mjs katsayısı: ' + k);
      assert.ok(panel.includes(k), 'allometry.js katsayısı: ' + k);
    }
    assert.match(HTML, /AGB = 0\.0673·\(ρ·D²·H\)\^0\.976/);
    assert.match(HTML, /AGB×0\.26/);
    assert.match(HTML, /0\.47 katsayısı/);
  });

  test('calcRow altın değer: Chave 2014 + BGB 0,26 + C 0,47 zinciri', () => {
    const r = calcRow(107, 12, 'KARAÇAM', 'İBRELİ', { rho: RHO, grho: GRHO });
    /* bağımsız yeniden yazım (elle sabit yazılmadı) */
    const agb = 0.0673 * Math.pow((RHO['KARAÇAM'] / 1000) * 107 * 107 * 12, 0.976);
    assert.ok(Math.abs(r.agb - agb) < 1e-9, 'AGB: ' + r.agb);
    assert.ok(Math.abs(r.bhb - agb * 0.26) < 1e-9, 'BGB = AGB×0,26');
    assert.ok(Math.abs(r.total_carbon - (agb + agb * 0.26) * 0.47) < 1e-9, 'C = (AGB+BGB)×0,47');
    assert.ok(Math.abs(r.total_carbon - 1972.827017) < 1e-4, 'P7 altın değer: ' + r.total_carbon);
    /* π yalnız hacim (daire kesit alanı) matematiğinde: DBH π ile BÖLÜNMEZ */
    assert.match(mc0(), /Math\.PI \* Math\.pow\(d \/ 200, 2\)/);
  });

  test('panel motoru (src/services/allometry.js) aynı sayıyı verir', () => {
    const { calc } = loadApp(['src/config/species.js', 'src/services/allometry.js']);
    const p = calc(107, 12, 'KARAÇAM', 'İBRELİ');
    assert.ok(Math.abs(p.total_carbon - 1972.827017) < 1e-4, 'panel P7: ' + p.total_carbon);
  });

  test('MC yapılandırması değişmedi (N, SEED, SD, CV, CONF)', () => {
    assert.equal(MC_CFG.N, 1000);
    assert.equal(MC_CFG.SEED, 20260926);
    assert.equal(MC_CFG.DBH_SD_CM, 0.5);
    assert.equal(MC_CFG.H_SD_M, 0.25);
    assert.equal(MC_CFG.MODEL_CV, 0.22);
    assert.equal(MC_CFG.CONF, 0.95);
    assert.deepEqual(dgData(HTML).mc, MC_CFG, 'DG_DATA.mc');
  });

  test('CSV biçimi ve veri tabanı şeması değişmedi (yeni migration YOK)', () => {
    assert.match(read('scripts/make-report.mjs'),
      /const head = 'NOKTA,TUR,GRUP,DBH_CM,BOY_M,KARBON_KG,KARBON_CI_LO_KG,KARBON_CI_HI_KG,ENLEM,BOYLAM,GPS_DOGRULUK_M,TARIH'/);
    const mig = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => /\.sql$/.test(f));
    assert.ok(mig.includes('0013_restore_measurements.sql'), '0013 iade migrationı yerinde');
    for (const f of mig) assert.ok(parseInt(f.slice(0, 4), 10) <= 25, '0031 yeni migration EKLEMEMELİ: ' + f);
    assert.match(read('supabase/migrations/0001_init_v2_1.sql'), /dbh_cm/i);
    /* dbh_cm kolonunun birimi/bölünmesi üzerine HİÇBİR migration 0031 ile değişmedi */
    assert.ok(!mig.some((f) => /^00(2[6-9]|3\d)/.test(f)), 'beklenmeyen yeni migration numarası');
  });
});

describe('0031 · aynı veri + aynı formül → QA hükmü değişince SAYILAR değişmez', () => {
  test('üç durum da aynı çizelgeleri, toplamı, GA ve t/ha değerini basar', () => {
    const T = [R_OK, R, R_BAD].map((x) => tables(x.html));
    const head = 'Tür|Grup|n|Ort. DBH (cm)|Ort. boy (m)|Karbon (kg)|Pay';
    for (let i = 1; i < T.length; i++) {
      for (const [k, rows] of T[0]) {
        if (/^Kontrol\|Sonuç\|Ayrıntı$/.test(k)) continue; /* Çizelge 4: QA hükümleri */
        assert.ok(T[i].has(k), 'çizelge kayboldu: ' + k);
        assert.deepEqual(T[i].get(k), rows, 'çizelge değişti: ' + k);
      }
    }
    assert.ok(T[0].has(head), 'tür çizelgesi bulunamadı: ' + [...T[0].keys()].join(' // '));
    assert.equal(ciText(R_OK.html), ciText(R.html));
    assert.equal(ciText(R.html), ciText(R_BAD.html));
    assert.match(ciText(R.html), /Toplam karbon stoku/, 'başlık toplamı');
    const perHa = (h) => (h.match(/[\d.,]+\s*t\/ha olarak bulunmuştur/) || [null])[0];
    assert.equal(perHa(R_BAD.html), perHa(R_OK.html), 'hektar karşılığı aynı');
  });

  test('DG_DATA (web + print/PDF veri katmanı) üç durumda da birebir aynı', () => {
    const pick = (o) => JSON.stringify({
      totals: o.totals, species: o.species, rows: o.rows, mc: o.mc, lulc: o.lulc,
      geofence: o.geofence, geometry_qa: o.geometry_qa, park: o.park, period: o.period,
      moderation: o.moderation, provenance: o.provenance,
    });
    const a = pick(dgData(R_OK.html)), b = pick(dgData(R.html)), c = pick(dgData(R_BAD.html));
    assert.equal(b, a, '🟡 İNCELEME = 🟢 GEÇERLİ sayıları');
    assert.equal(c, a, '🔴 BLOKLU = 🟢 GEÇERLİ sayıları');
  });

  test('DBH ve karbon satır düzeyinde olduğu gibi taşınır (dönüşüm izi yok)', () => {
    const d = dgData(R.html);
    assert.equal(d.rows.length, ROWS.length);
    d.rows.forEach((r, i) => {
      assert.equal(r.dbh_cm, ROWS[i].dbh_cm, 'P' + r.point_id + ' DBH cm olarak aynen taşınmalı');
      assert.equal(r.carbon_kg, ROWS[i].carbon_kg, 'P' + r.point_id + ' karbon');
    });
    /* π ile bölünmüş bir DBH hiçbir satırda yok */
    for (const r of d.rows) {
      const asGirth = r.dbh_cm / Math.PI;
      assert.ok(!ROWS.some((q) => Math.abs(q.dbh_cm - asGirth) < 0.005), 'DBH π ile bölünmüş: P' + r.point_id);
    }
    assert.equal(d.totals.carbon_kg, SUM);
    assert.equal(d.totals.n, ROWS.length);
  });

  test('metadata.json sayıları ve künyesi raporla tutarlı', () => {
    assert.equal(MD.sampleSize, ROWS.length);
    assert.equal(MD.license, 'CC-BY-NC-4.0');
    assert.equal(MD.resultHash, 'sha256:' + R.hash);
    assert.equal(R_BAD.md.sampleSize, MD.sampleSize, 'durum değişince örneklem değişmez');
  });
});

describe('0031 · DBH = göğüs çapı (cm): dönüşüm iddiası YOK', () => {
  test('rapor metninde ÷π / çevre türetmesi / sistemik birim hatası geçmiyor', () => {
    for (const bad of ['DBH = çevre ÷ π', 'çevre ÷ π', 'çevre/π', 'çevre / π', 'sistemik birim hatası', 'ölçü birimi hatası', '⛔'])
      assert.ok(!HTML.includes(bad), 'yasak metin raporda kaldı: ' + bad);
    /* inceleme/valid durumunda GEÇİCİDİR damgası basılmaz (yalnız 🔴 BLOKLU) */
    for (const h of [HTML, R_OK.html]) {
      assert.ok(!h.includes('GEÇİCİDİR'), 'blok olmayan rapor GEÇİCİDİR damgası taşımamalı');
      assert.ok(!h.includes('KULLANILMAMALIDIR'), 'blok olmayan rapor kullanım yasağı taşımamalı');
    }
    assert.match(R_BAD.html, /GEÇİCİDİR/, 'damga yalnız kritik blokta basılır');
    assert.match(R_BAD.html, /KULLANILMAMALIDIR/);
  });

  test('§4.1 DBH tanımı: göğüs çapı, 1,30 m, cm, dönüşüm uygulanmadan', () => {
    assert.match(HTML, /4\.1 Saha protokolü\./);
    assert.match(HTML, /Göğüs çapı \(DBH; <i>Diameter at Breast Height<\/i>\)/);
    assert.match(HTML, /1,30 m yükseklikteki gövde çapıdır/);
    assert.match(HTML, /santimetre \(cm\) cinsinden ölçülerek doğrudan kaydedilmiştir/);
    assert.match(HTML, /herhangi bir çevre→çap dönüşümü uygulanmadan/);
  });

  test('§4.2 model girdisi: D = sahada ölçülen göğüs çapı (cm)', () => {
    assert.match(HTML, /D = sahada ölçülen göğüs çapı \(DBH\), cm/);
    assert.match(HTML, /DBH \(cm\) → boy \(m\) → odun yoğunluğu \(ρ\) → AGB → BGB → karbon → belirsizlik/);
  });

  test('§4.6 Veri sözlüğü + Ölçüm notu basılıyor', () => {
    assert.match(HTML, /4\.6 Veri sözlüğü/);
    assert.match(HTML, /<b>Ölçüm notu:<\/b>/);
    const i = HTML.indexOf('4.6 Veri sözlüğü');
    const seg = HTML.slice(i, i + 3500);
    assert.match(seg, /DBH/, 'sözlükte DBH satırı');
    assert.match(seg, /göğüs/i, 'DBH tanımı göğüs çapı');
    assert.match(seg, /\bcm\b/, 'DBH birimi cm');
    assert.match(seg, /h\/DBH/, 'oran satırı inceleme göstergesi olarak tanımlı');
  });

  test('kod bekçisi: src/ ve scripts/ içinde DBH hiçbir yerde π ile BÖLÜNMÜYOR', () => {
    /* π ile ÇARPMAK meşrudur (daire kesit alanı, hacim, türetilmiş çevre
     * kolonu); yasak olan π ile BÖLÜP DBH türetmektir (0011in yanlış
     * varsayımı). */
    const bad = [];
    for (const f of codeFiles()) {
      read(f).split('\n').forEach((ln, i) => {
        if (/\/\s*Math\.PI/.test(ln) && /(dbh|cap_cm|çap|girth|cevre|çevre)/i.test(ln)) bad.push(`${f}:${i + 1}: ${ln.trim()}`);
        if (/DBH\s*=\s*çevre/.test(ln)) bad.push(`${f}:${i + 1}: DBH = çevre iddiası`);
      });
    }
    assert.deepEqual(bad, [], 'π ile DBH türetmesi bulundu:\n' + bad.join('\n'));
    /* π ile bölme yalnız koordinat/daire matematiğinde kalır (rad→dere, yarıçap) */
    for (const f of codeFiles()) {
      for (const ln of read(f).split('\n')) {
        if (/\/\s*Math\.PI/.test(ln)) assert.ok(!/dbh/i.test(ln), f + ': ' + ln.trim());
      }
    }
  });

  test('içe aktarma aracı: çevre→çap dönüşümü kaldırıldı, --birim cevre reddedilir', () => {
    const t = read('scripts/import-measurements.mjs');
    assert.ok(!/Math\.PI/.test(t), 'import aracında π kullanımı kalmamalı');
    assert.match(t, /--birim cevre KALDIRILDI/);
    assert.match(t, /DBH = göğüs çapı \(cm\) kabul edildi/);
    assert.match(t, /DBH bu kolondan TÜRETİLMEZ/);
  });

  test('dokümantasyon güncel: methods.md + rapor-yayini.md', () => {
    const m = read('docs/methods.md');
    assert.match(m, /göğüs çapı/i);
    assert.ok(!/DBH \[cm\] = çevre \[cm\] \/ π/.test(m), 'eski dönüşüm formülü docs içinde kalmamalı');
    assert.match(m, /Boy\/DBH oranı incelemesi/);
    assert.match(m, /asla blok değil/i);
    const y = read('docs/rapor-yayini.md');
    assert.match(y, /🟡\s*\**İNCELEME/, 'üç hâlli durum belgelenmeli');
    assert.match(y, /🔴\s*\**BLOKLU/);
    assert.match(y, /🟢\s*\**GEÇERLİ/);
    assert.match(y, /Envanter birim kontrolü \(DBH\)/, 'yeni QA satır adı belgelenmeli');
    assert.match(y, /--birim cevre KALDIRILDI/);
  });
});

describe('0031+0033 · boy/DBH oranı: asla blok değil, geniş gövdede uyarı bile değil', () => {
  test('0033 · tipik bant dışı oran SAYIMDIR: geniş gövdeli fikstürde durum 🟢 GEÇERLİ', () => {
    assert.equal(QA.n, ROWS.length);
    assert.equal(QA.dbh_fail.length, 0, 'DBH geçerlilik ihlali yok: ' + JSON.stringify(QA.dbh_fail));
    /* P1 (110 cm / 10,2 m → 9,27), P7 (107 / 12 → 11,21), P29 (40 / 4,5 → 11,25)
     * tipik 15–120 bandının dışında; hiçbiri fiziksel olarak olanaksız değil ve
     * stand içi dağılıma göre (modified z) aykırı değil → UYARI YOK.
     * 0031de bu üç kayıt "olağandışı oranda" diye ⚠ üretiyordu. */
    assert.equal(QA.hd_band_out.length, 3, 'tipik bant dışı SAYIM: ' + JSON.stringify(QA.hd_band_out));
    assert.equal(QA.hd_fail.length, 0, 'aykırı kayıt yok: ' + JSON.stringify(QA.hd_fail));
    assert.equal(QA.hd_block, false, 'boy/çap ASLA bloklamaz');
    assert.equal(QA.hd_review, false, '0033: geniş gövde inceleme üretmez');
    assert.equal(QA.dev_fail.length, 0, 'saklı karbon motor değerleri → sapma yok');
    assert.equal(QA.state, QA_STATE.VALID, 'doğal durum 🟢: ' + QA.state);
    /* 0033 · eşik tabanlı gövde sınıfı beyanı YOK: dağılım yalnız betimleyici
     * (min 40 · medyan 75 · max 110 cm) ve ℹ️ kalemi üretilmez. */
    assert.equal(QA.anit, undefined, '0032 alanı kaldırıldı');
    assert.deepEqual(QA.dbh_stats, { n: 6, min: 40, medyan: 75, max: 110 });
    assert.deepEqual(QA.info, [], 'ℹ️ beyan kalemi üretilmiyor');
  });

  test('hd_block kodda kalıcı false: %100 ihlal bile bloklamaz', () => {
    assert.match(read('scripts/make-report.mjs'), /out\.hd_block = false;/);
    const rows = [];
    for (let i = 1; i <= 40; i++) rows.push({ id: i, point_id: i, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 100, height_m: 2, carbon_kg: null });
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.hd_fail.length, 40, 'hepsi gösterge aralığı dışında');
    assert.equal(qa.hd_block, false, 'hd_block kalıcı false');
    assert.equal(qa.state, QA_STATE.REVIEW, 'durum İNCELEME, BLOKLU değil');
  });

  test('kritik blok yalnız DBH geçerliliği / karbon bütünlüğünden gelir', () => {
    const bad = [1, 2, 3, 4].map((i) => ({ id: i, point_id: i, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: null, height_m: 10, carbon_kg: null }));
    const qaBad = inventoryQa(bad, dict);
    assert.equal(qaBad.dbh_block, true);
    assert.equal(qaBad.state, QA_STATE.BLOCKED);
    const ratio = [1, 2, 3, 4].map((i) => ({ id: i, point_id: i, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 120, height_m: 3, carbon_kg: null }));
    const qaRatio = inventoryQa(ratio, dict);
    assert.equal(qaRatio.hd_fail.length, 4);
    assert.equal(qaRatio.state, QA_STATE.REVIEW);
    /* DBH cm aralığı çap için tanımlı (çevre için değil) */
    assert.equal(QA_LIMITS.DBH_MIN_CM, 1);
    assert.equal(QA_LIMITS.DBH_MAX_CM, 400);
    assert.equal(QA_LIMITS.HD_MIN, 15);
    assert.equal(QA_LIMITS.HD_MAX, 120);
    assert.equal(QA_LIMITS.CARBON_DEV_PCT, 20);
    assert.equal(QA_LIMITS.CARBON_DEV_MIN_KG, 5);
    for (const r of Object.values(DBH_REASON_TR)) assert.ok(!/çevre/.test(r), 'gerekçe metni: ' + r);
  });

  test('DBH geçerlilik zinciri: eksik / sayısal değil / ≤0 / cm aralığı dışı', () => {
    const rows = [
      { point_id: 1, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: null, height_m: 12 },
      { point_id: 2, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 'yok', height_m: 12 },
      { point_id: 3, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: 0, height_m: 12 },
      { point_id: 4, species: 'MEŞE', grp: 'YAPRAKLI', dbh_cm: QA_LIMITS.DBH_MAX_CM + 1, height_m: 12 },
    ];
    const qa = inventoryQa(rows, dict);
    assert.deepEqual(qa.dbh_fail.map((x) => [x.point_id, x.reason]),
      [[1, 'eksik'], [2, 'sayisal-degil'], [3, 'pozitif-degil'], [4, 'aralik-disi']]);
    assert.equal(qa.dbh_block, true, '4/4 sistemik → kritik veri hatası bloklar');
    assert.equal(qa.state, QA_STATE.BLOCKED);
  });
});

describe('0031 · üç hâlli rapor durumu (Çizelge 4ten türetilir)', () => {
  test('qaStateOf önceliği: block > review > valid', () => {
    assert.equal(qaStateOf({}), QA_STATE.VALID);
    assert.equal(qaStateOf({ review: true }), QA_STATE.REVIEW);
    assert.equal(qaStateOf({ block: true }), QA_STATE.BLOCKED);
    assert.equal(qaStateOf({ block: true, review: true }), QA_STATE.BLOCKED);
    assert.deepEqual(Object.keys(QA_STATE).sort(), ['BLOCKED', 'REVIEW', 'VALID']);
  });

  test('künye rozeti duruma göre değişir; sabit "Geçerli" rozeti yok', () => {
    assert.equal(badge(R_OK.html), '🟢 GEÇERLİ');
    assert.equal(badge(HTML), '🟡 İNCELEME');
    assert.equal(badge(R_BAD.html), '🔴 BLOKLU');
    assert.match(R_OK.html, /class="st st-ok">🟢 GEÇERLİ</);
    assert.match(HTML, /class="st st-warn">🟡 İNCELEME</);
    assert.match(R_BAD.html, /class="st st-bad">🔴 BLOKLU</);
    for (const h of [R_OK.html, HTML, R_BAD.html]) assert.ok(!/class="st">Geçerli</.test(h), 'eski sabit rozet kalkmalı');
  });

  test('§7 üç hâli tanımlar ve bu raporun durumunu sayıyla beyan eder', () => {
    assert.match(HTML, /Bu raporun QA durumu: 🟡 İNCELEME/);
    assert.match(HTML, /Rapor QA durumu üç hâllidir/);
    assert.match(HTML, /🔴 BLOKLU/);
    assert.match(HTML, /kritik veri hatası vardır, karbon sonucu bilimsel iletişimde kullanılmamalıdır/);
    assert.match(HTML, /🟢 GEÇERLİ/);
    assert.match(HTML, /tüm kritik kontroller geçmiştir/);
    assert.match(HTML, /veri hatası hükmü DEĞİLDİR/);
    assert.match(HTML, /3\/6 kayıt fiziksel makullük bandı dışında veya stand içi aykırı/, 'inceleme kalemi §7 girişinde sayıyla');
    assert.match(HTML, /3\/6 kayıt gövde formu açısından makul · 3 kayıt inceleme istiyor/, 'Çizelge 4 ayrıntısı sayıyla');
    assert.match(HTML, /fiziksel makullük bandı \(3–200\) dışı/, 'ihlalin hangi ölçütten geldiği yazılı');
    assert.match(HTML, /modified z/, 'robust ölçüt beyan edilir');
    assert.match(HTML, /yayını bloklamaz/, 'oranın bloklamadığı açıkça yazılı');
  });

  test('QA çizelgesinde yeni satır adları var, eski ⛔ hükmü yok', () => {
    for (const k of ['Envanter birim kontrolü (DBH)', 'Boy/DBH oranı incelemesi', 'Karbon yeniden hesabı'])
      assert.ok(HTML.includes(k), 'QA satırı: ' + k);
    assert.ok(!HTML.includes('Envanter tutarlılığı (h/d)'), 'eski satır adı kalkmalı');
    assert.match(HTML, /çevre→çap dönüşümü uygulanmamıştır/);
    assert.match(R_BAD.html, /⛔ Blok/, 'blok işareti yalnız kritik ihlalde');
    assert.match(R_BAD.html, /DBH kaydı yok|DBH ≤ 0|DBH cm aralığı dışında/, 'blok gerekçesi DBH geçerliliği');
  });

  test('§9 sınırlılıklar: oran bir inceleme göstergesi olarak anlatılır', () => {
    assert.match(HTML, /Bu oran bir İNCELEME GÖSTERGESİDİR/);
    assert.match(HTML, /rapor bu gerekçeyle bloklanmaz/);
    assert.match(HTML, /DBH değerleri göğüs çapı \(cm\) olarak kabul edilmiş/);
    assert.ok(!/ölçü birimi hatası/.test(HTML), 'eski birim hatası hükmü kalkmalı');
  });

  test('metadata.json: variables (DBH=cm) + measurementNote + qaState', () => {
    const dbh = MD.variables.find((v) => v.name === 'DBH');
    assert.ok(dbh, 'DBH değişkeni');
    assert.equal(dbh.unit, 'cm');
    assert.match(dbh.description, /[Gg]öğüs çapı/);
    assert.match(MD.measurementNote, /çevre→çap dönüşümü uygulanmadan/);
    assert.equal(MD.qaState, QA_STATE.REVIEW);
    assert.equal(MD.qaStateLabel, '🟡 İNCELEME');
    assert.equal(R_OK.md.qaState, QA_STATE.VALID);
    assert.equal(R_OK.md.qaStateLabel, '🟢 GEÇERLİ');
    assert.equal(R_BAD.md.qaState, QA_STATE.BLOCKED);
    assert.equal(R_BAD.md.qaStateLabel, '🔴 BLOKLU');
    const ratio = MD.variables.find((v) => v.name === 'h/DBH');
    assert.match(ratio.description, /inceleme göstergesi/);
    /* sözlükteki birimler karbon zinciriyle tutarlı */
    const units = Object.fromEntries(MD.variables.map((v) => [v.name, v.unit]));
    assert.deepEqual(units, { DBH: 'cm', 'Boy (H)': 'm', rho: 'g/cm3', AGB: 'kg', BGB: 'kg', Karbon: 'kg C', 'h/DBH': 'birimsiz' });
  });
});

/* mc.mjs kaynağı (calcRow hacim satırı π çarpanını belgelemek için) */
function mc0() { return read('scripts/lib/mc.mjs'); }
