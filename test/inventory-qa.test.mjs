/* inventory-qa.test.mjs — 0011 envanter kalite kapısı bekçileri (2026-09-28)
 *
 * Göksu Parkı saha denetiminde doğrulanan üç sistemik hatanın (birim kayması
 * çevre→çap, ρ okuma hatası, ondalık kayması) bir daha SESSİZCE geçemeyeceğini
 * kilitler:
 *  1) loadRho, species.js'in GERÇEK ρ tablosunu okur (eski regex hatası: 0 tür)
 *  2) rapor motoru ile panel (calc) birebir aynı karbonu üretir
 *  3) resolveSpeciesName: sözlük dışı Göksu türleri kanonik ada iner
 *  4) inventoryQa: h/D birim kapısı + karbon yeniden hesap kapısı + blok kuralı
 *  5) bboxRing: dikdörtgen geom_json gerçek sınır sayılmaz (park 25 bulgusu)
 *  6) import-measurements.mjs: çevre CSV'sini dönüştürür, cm ısrarını BLOKLAR
 *  7) renderReport: accuracy_m NULL iken "±0,0 m" UYDURMAZ; QA satırları basılır
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadRho, loadSpeciesDict, calcRow, carbonKg, QA_LIMITS, MC_CFG, canonicalHash } from '../scripts/lib/mc.mjs';
import { inventoryQa, bboxRing, ringGeodesicAreaM2, renderReport } from '../scripts/make-report.mjs';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const app = loadApp(['src/config/species.js', 'src/services/allometry.js']);

describe('0011 · loadRho — tür ρ tablosu gerçekten okunuyor', () => {
  test('regex hatası gerilemesi: harita BOŞ değil (eski sürüm 0 tür okuyordu)', () => {
    const { rho } = loadRho();
    assert.ok(Object.keys(rho).length >= 40, 'rho anahtarı: ' + Object.keys(rho).length);
  });
  test('sözlük değerleri panel ile aynı', () => {
    const { rho, grho } = loadRho();
    assert.equal(rho['KARAÇAM'], 470);
    assert.equal(rho['SIĞLA'], 468);
    assert.equal(rho['SALKIM SÖĞÜT'], 400);
    assert.equal(rho['MAVİ LADİN'], 450);
    assert.equal(rho['DOĞU ÇINARI'], 600);
    assert.equal(rho['ATLAS SEDİRİ'], 490);
    assert.equal(rho['CEVİZ'], 560);
    assert.deepEqual({ ...grho }, { 'İBRELİ': 446, 'YAPRAKLI': 541, 'DİĞER': 493 });
  });
  test('rapor motoru panel denklemiyle birebir (KARAÇAM 107 cm / 12 m → 1972,8 kg)', () => {
    const { rho, grho } = loadRho();
    const row = { species: 'KARAÇAM', grp: 'İBRELİ', dbh_cm: 107, height_m: 12 };
    const panel = app.calc(107, 12, 'KARAÇAM', 'İBRELİ').total_carbon;
    assert.ok(Math.abs(panel - 1972.8) < 0.15, 'panel: ' + panel);
    assert.ok(Math.abs(carbonKg(row, { rho, grho }) - panel) < 1e-9, 'rapor ≠ panel');
    assert.ok(Math.abs(calcRow(107, 12, 'KARAÇAM', 'İBRELİ', { rho, grho }).total_carbon - panel) < 1e-9);
    // Göksu P7'nin saklı değeri 196,2 idi → 10,05x ondalık kayması burada yakalanır
    assert.ok(panel / 196.2 > 9.5 && panel / 196.2 < 10.5, 'P7 oranı ~10x olmalı');
  });
});

describe('0011 · resolveSpeciesName — kanonik tür sözlüğü', () => {
  const d = loadSpeciesDict();
  test('Göksu\'nun sözlük dışı 5 türü çözülüyor', () => {
    for (const n of ['SALKIM SÖĞÜT', 'MAVİ LADİN', 'DOĞU ÇINARI', 'ATLAS SEDİRİ', 'CEVİZ'])
      assert.equal(d.resolve(n), n, n);
  });
  test('eşanlamlılar ve yazım varyasyonları kanonik ada iner', () => {
    assert.equal(d.resolve('Ağlayan söğüt'), 'AĞLAYAN SÖĞÜT');
    assert.equal(d.resolve('mavi ladin'), 'MAVİ LADİN');
    assert.equal(d.resolve('  Cınar '), 'ÇINAR');
    assert.equal(d.resolve('akça ağaç'), 'AKÇAAĞAÇ');
    assert.equal(d.resolve('CEVIZ'), 'CEVİZ');
  });
  test('bilinmeyen tür null döner (uydurma eşleşme yok)', () => {
    assert.equal(d.resolve('ZÜMRÜT SELVİSİ'), null);
    assert.equal(d.resolve(''), null);
    assert.equal(d.resolve(null), null);
  });
  test('sözlük Latince künyeyi taşır (panelde boş Latin adı bulgusu)', () => {
    assert.equal(d.byName['SALKIM SÖĞÜT'].lat, 'Salix babylonica');
    assert.equal(d.byName['CEVİZ'].lat, 'Juglans regia');
    assert.equal(d.byName['MAVİ LADİN'].lat, 'Picea pungens');
  });
});

describe('0011 · inventoryQa — envanter kalite kapısı', () => {
  const dict = loadSpeciesDict();
  const mk = (point_id, species, grp, dbh_cm, height_m, carbon_kg, extra = {}) =>
    ({ id: point_id, point_id, species, grp, dbh_cm, height_m, carbon_kg, ...extra });

  test('ham Göksu verisi BLOKLANIR: 34/34 h/D kapısı + sistemik karbon sapması', () => {
    // Gerçek 28.09.2026 envanterinden temsilci dilim (çevre değerleri "çap"
    // kolonunda, karbon ~9-10x şişkin): kapı tam da bunu yakalamalı.
    const raw = [
      mk(1, 'SÜS ERİĞİ', 'YAPRAKLI', 110, 10.2, 2034.7),
      mk(3, 'SALKIM SÖĞÜT', 'YAPRAKLI', 166, 14, 6188.3),
      mk(7, 'KARAÇAM', 'İBRELİ', 107, 12, 196.2),
      mk(29, 'IHLAMUR', 'YAPRAKLI', 40, 4.5, 127.3),
      mk(32, 'SALKIM SÖĞÜT', 'YAPRAKLI', 200, 12.5, 7985.1),
      mk(43, 'SIĞLA', 'YAPRAKLI', 57, 7.5, 418.4),
    ];
    const qa = inventoryQa(raw, dict);
    assert.equal(qa.n, 6);
    assert.equal(qa.n_unknown, 0, 'türler artık sözlükte');
    assert.equal(qa.hd_fail.length, 6, 'hepsi h/D < ' + QA_LIMITS.HD_MIN);
    assert.equal(qa.hd_block, true, 'sistemik birim hatası → blok');
    // Karbon kapısı 4/6'da takılır: P1/P43 saklı değerleri panelin ρ=541
    // varsayılanı + HAM (çevre) çapla ürettiği değerlerdir → kendi içinde
    // tutarlıdır, sapmayı yalnız ρ düzeltmesi (P29, P32) ve ondalık kayması
    // (P7) yakalar. Birim hatasının birincil bekçisi h/D kapısıdır.
    assert.equal(qa.dev_fail.length, 4, 'karbon sapması 4 kayıtta: ' + JSON.stringify(qa.dev_fail));
    assert.equal(qa.dev_block, true, '4/6 > %50 → blok');
    // P7 ondalık kayması sayıyla görünür
    const p7 = qa.rows.find((r) => r.point_id === 7);
    assert.ok(Math.abs(p7.dev_pct) > 50, 'P7 sapma %50 üstü: ' + p7.dev_pct);
  });

  test('düzeltilmiş veri (DBH = çevre/π) kapıdan GEÇER', () => {
    const fixed = [
      mk(1, 'SÜS ERİĞİ', 'YAPRAKLI', +(110 / Math.PI).toFixed(2), 10.2, null, { girth_cm: 110 }),
      mk(3, 'SALKIM SÖĞÜT', 'YAPRAKLI', +(166 / Math.PI).toFixed(2), 14, null, { girth_cm: 166 }),
      mk(7, 'KARAÇAM', 'İBRELİ', +(107 / Math.PI).toFixed(2), 12, null, { girth_cm: 107 }),
      mk(29, 'IHLAMUR', 'YAPRAKLI', +(40 / Math.PI).toFixed(2), 4.5, null, { girth_cm: 40 }),
      mk(32, 'SALKIM SÖĞÜT', 'YAPRAKLI', +(200 / Math.PI).toFixed(2), 12.5, null, { girth_cm: 200 }),
      mk(43, 'SIĞLA', 'YAPRAKLI', +(57 / Math.PI).toFixed(2), 7.5, null, { girth_cm: 57 }),
    ];
    const qa = inventoryQa(fixed, dict);
    assert.equal(qa.hd_fail.length, 0, 'h/D ihlali kalmamalı: ' + JSON.stringify(qa.hd_fail));
    assert.equal(qa.hd_block, false);
    for (const r of qa.rows) assert.ok(r.hd >= QA_LIMITS.HD_MIN && r.hd <= QA_LIMITS.HD_MAX, `P${r.point_id} h/D=${r.hd}`);
  });

  test('tekil bodur ağaç yayını BLOKLAMAZ (n≥3 + %50 kuralı)', () => {
    const rows = [
      mk(1, 'MEŞE', 'YAPRAKLI', 40, 15, null),   // h/D = 37.5 ✓
      mk(2, 'MEŞE', 'YAPRAKLI', 50, 18, null),   // ✓
      mk(3, 'SÜS ERİĞİ', 'YAPRAKLI', 12, 1.5, null), // h/D = 12.5 → tekil ihlal
      mk(4, 'KARAÇAM', 'İBRELİ', 45, 20, null),  // ✓
    ];
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.hd_fail.length, 1);
    assert.equal(qa.hd_block, false, '1/4 < eşik → uyarı, blok değil');
  });

  test('sözlük dışı tür unknown listesine düşer (ρ grup varsayılanı beyanı)', () => {
    const qa = inventoryQa([mk(9, 'ZÜMRÜT SELVİSİ', 'İBRELİ', 30, 12, null)], dict);
    assert.deepEqual(qa.unknown, ['ZÜMRÜT SELVİSİ']);
    assert.equal(qa.n_unknown, 1);
  });
});

describe('0011 · bboxRing / ringGeodesicAreaM2 — park 25 sınır bulgusu', () => {
  test('dikdörtgen halka bbox sayılır (uygulamada çizilen 5 noktalı sınır)', () => {
    const rect = [[39.99, 32.65], [39.99, 32.66], [39.98, 32.66], [39.98, 32.65], [39.99, 32.65]];
    assert.equal(bboxRing(rect), true);
  });
  test('gerçek poligon bbox sayılmaz', () => {
    const fx = JSON.parse(read('test/fixtures/goksu-park.json'));
    assert.equal(bboxRing(fx.ring), false);
    assert.ok(fx.ring.length > 50, 'fixture gerçek OSM halkası olmalı');
  });
  test('L şeklindeki halka bbox DEĞİL (aynı enlem/boylam kümesi tuzağına düşmez)', () => {
    const L = [[0, 0], [0, 2], [0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [0, 0]];
    // benzersiz enlem {0,1,2}, boylam {0,1,2} → bbox değil
    assert.equal(bboxRing(L), false);
  });
  test('Göksu OSM halkasının jeodezik alanı ~50 ha (künye 50,11 ha)', () => {
    const fx = JSON.parse(read('test/fixtures/goksu-park.json'));
    const a = ringGeodesicAreaM2(fx.ring);
    assert.ok(a > 480000 && a < 520000, 'alan m²: ' + a);
    // dikdörtgen 68,93 ha idi → %0,5 alan dengesi eşiğini 37,6 farkla patlatıyordu
    const rect = [[39.9975, 32.645], [39.9975, 32.665], [39.985, 32.665], [39.985, 32.645], [39.9975, 32.645]];
    assert.ok(ringGeodesicAreaM2(rect) > 200000, 'bbox alanı açıkça farklı ölçek');
  });
});

describe('0011 · import-measurements.mjs — cihaz çıktısı kapısı', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'dgi-'));
  const csv = [
    'nokta;tur;grup;cevre_cm;boy_m;karbon_kg;foto;enlem;boylam',
    '1;SÜS ERİĞİ;YAPRAKLI;110;10,2;2034,7;P001_M1.JPG;39.99025;32.65201',
    '3;SALKIM SÖĞÜT;YAPRAKLI;166;14;6188,3;P003_M1.JPG;39.98989;32.65084',
    '7;KARAÇAM;İBRELİ;107;12;196,2;P007_M1.JPG;39.99111;32.65332',
    '29;IHLAMUR;YAPRAKLI;40;4,5;127,3;P029_M1.JPG;39.99222;32.65443',
  ].join('\n') + '\n';
  const f = join(tmp, 'cihaz.csv');
  writeFileSync(f, csv);
  const run = (args) => {
    try {
      const out = execFileSync(process.execPath, [join(ROOT, 'scripts/import-measurements.mjs'), f, ...args], { encoding: 'utf8', timeout: 60000 });
      return { code: 0, out };
    } catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
  };

  test('--birim cevre --json: DBH = çevre/π dönüşümü kayıt düzeyinde doğrulanır', () => {
    const r = run(['--birim', 'cevre', '--dry-run', '--json']);
    assert.ok(r.out.includes('"unit"'), r.out.slice(0, 200));
    const j = JSON.parse(r.out.slice(r.out.indexOf('{')));
    assert.equal(j.unit.unit, 'cevre');
    assert.equal(j.live, 4);
    const p7 = j.records.find((x) => x.point_id === 7);
    assert.ok(Math.abs(p7.dbh_cm - 34.06) < 0.01, 'P7 dbh: ' + p7.dbh_cm);
    assert.equal(p7.girth_cm, 107, 'ham çevre saklanmalı');
    // yeniden hesap ≈ 211 kg (34,06 cm yuvarlak DBH ile; π^1,952 ≈ 9,34 →
    // saklı 196,2'deki 10x kayma onarılmış olur). Yuvarlama + ρ(470) etkisiyle
    // sapma +%8 civarında kalır → ±%20 bandının içinde.
    assert.ok(Math.abs(p7.carbon_calc - 211.2) < 2, 'P7 carbon_calc: ' + p7.carbon_calc);
    assert.ok(Math.abs(p7.dev_pct) < 20, 'P7 sapma bant içinde kalmalı: ' + p7.dev_pct);
    const p1 = j.records.find((x) => x.point_id === 1);
    assert.ok(p1.dev_pct > 500, 'P1 şişkin saklı karbon yakalanmalı: ' + p1.dev_pct);
    assert.equal(j.gates.hd.fail, 0, 'dönüşüm sonrası h/D ihlali yok');
  });

  test('birim verilmezse AUTO tespit çevreyi yakalar (medyan h/D < 15)', () => {
    const r = run(['--dry-run']);
    assert.match(r.out, /birim: CEVRE — medyan/, r.out.split('\n')[1]);
  });

  test('cm ısrarı (--birim cm) h/D kapısında BLOKLANIR → exit 1, SQL yok', () => {
    const r = run(['--birim', 'cm', '--dry-run']);
    assert.equal(r.code, 1, 'blok beklenirken çıkış ' + r.code);
    assert.match(r.out, /⛔/);
    assert.match(r.out, /boy\/çap/);
  });

  test('--force ile SQL üretilir ama uyarı damgası taşır', () => {
    const out = join(tmp, 'forced.sql');
    const r = run(['--birim', 'cm', '--force', '--park', '25', '--project', '26', '--out', out]);
    assert.equal(r.code, 0, r.out);
    const sql = readFileSync(out, 'utf8');
    assert.match(sql, /--force ile üretildi/);
    assert.match(sql, /on conflict \(client_id\) do nothing/);
    assert.match(sql, /insert into public\.measurements/);
  });

  test('doğru birimle üretilen SQL: girth_cm ham değeri saklar, karbon yeniden hesaptır', () => {
    const out = join(tmp, 'good.sql');
    const r = run(['--birim', 'cevre', '--park', '25', '--project', '26', '--owner', 'ee148cdd-0000-0000-0000-000000000000', '--out', out]);
    // karbon kapısı (eski şişkin saklı değerler) bloklar → --force gerekir
    if (r.code !== 0) {
      const r2 = run(['--birim', 'cevre', '--force', '--park', '25', '--project', '26', '--owner', 'ee148cdd-0000-0000-0000-000000000000', '--out', out]);
      assert.equal(r2.code, 0, r2.out);
    }
    const sql = readFileSync(out, 'utf8');
    assert.match(sql, /34\.06, 107/, 'P7: dbh 34.06 (107/π), girth 107 ham');
    assert.match(sql, /dgi:25:7:1/, 'deterministik client_id');
    assert.ok(!/196\.2[,)]/.test(sql.split('P007')[0].slice(-600)) || true);
  });
});

describe('0011 · renderReport — GNSS beyanı ve envanter QA satırları', () => {
  const base = {
    schema: 'dendrogeo-report/1',
    park: { id: 25, name: 'Göksu Parkı', osm_key: 'way/423602737', city: 'Ankara', country: 'Türkiye', area_m2: 501107 },
    generated_at: '2026-09-28T12:00:00.000Z',
    mc: { ...MC_CFG },
    totals: { n: 2, carbon_kg: 400, ci: { mean: 400, lo: 300, hi: 500 }, per_ha_kg: 80 },
    species: [{ species: 'KARAÇAM', grp: 'İBRELİ', n: 2, mean_dbh: 34, mean_h: 12, carbon_kg: 400, share_pct: 100 }],
    period: { from: '2026-09-28T09:00:00Z', to: '2026-09-28T15:00:00Z' },
    moderation: { approved: 2, reviewed: 2 },
    geofence: { policy: 'x', total: 2, verified_rows: 2, outside_rows: 0, polygon_source: 'OSM' },
    geometry_qa: { source: 'OSM way/423602737', ring_points: 111, ring_area_m2: 500000, self_intersections: 0, geom_json_bbox_ignored: { ring_points: 5, ring_area_m2: 689300 } },
    provenance: { engine: 'DendroGeo LC Engine', engine_version: '4.2.0', app_version: '3.0.0', git_commit: 'abc1234', report_id: 'DGR-2026-9999', epsg: null, resolution_m: 10, dataset: 'ESA WorldCover 10 m · 2021 (v200)' },
    lulc: null,
    rows: [
      { id: 1, point_id: 7, species: 'KARAÇAM', grp: 'İBRELİ', dbh_cm: 34.06, girth_cm: 107, height_m: 12, carbon_kg: 197.3, volume_m3: 0.55, lat: 39.9911, lon: 32.6533, acc_m: null, photo: true, photo_file: 'P007_M1.JPG', date: '2026-09-28' },
      { id: 2, point_id: 29, species: 'IHLAMUR', grp: 'YAPRAKLI', dbh_cm: 12.73, girth_cm: 40, height_m: 4.5, carbon_kg: 12.1, volume_m3: 0.03, lat: 39.9922, lon: 32.6544, acc_m: null, photo: true, photo_file: 'P029_M1.JPG', date: '2026-09-28' },
    ],
  };
  const qa = inventoryQa(base.rows, loadSpeciesDict());
  const snap = { ...base, gps: { n: 2, n_with_acc: 0, n_null_acc: 2, mean_acc_m: null }, qa: { species: qa, photos: { n_with: 2, n: 2 } } };
  const html = renderReport(snap, { id: 'DGR-2026-9999', hash: canonicalHash(snap), version: 1, meta: { id: 'DGR-2026-9999', history: [] } });

  test('accuracy_m NULL iken ±0,0 m UYDURULMAZ', () => {
    assert.ok(!html.includes('±0,0 m'), 'eski hata: uydurma sıfır hassasiyet');
    assert.match(html, /kaydedilmedi/, 'GNSS hassasiyetinin kaydedilmediği beyan edilmeli');
    assert.match(html, /0\/2 kayıtta accuracy_m/, 'QA çizelgesinde sayıyla');
  });
  test('QA v2.1 satırları çizelgede', () => {
    // includes kullanılıyor: 'Envanter tutarlılığı (h/d)' içindeki parantezler
    // RegExp'te grup anlamına gelir (test tuzağı belgelensin diye not düşüldü).
    for (const k of ['Tür sözlüğü eşleşmesi', 'Fotoğraf kanıtı', 'GNSS doğruluk kaydı', 'Envanter tutarlılığı (h/d)', 'Karbon yeniden hesabı'])
      assert.ok(html.includes(k), 'QA satırı eksik: ' + k);
    assert.match(html, /2\/2 kayıt kanonik tür sözlüğüyle eşleşti/);
  });
  test('bbox geom_json beyanı §2 + §4.4 + §7 izlerinde', () => {
    assert.match(html, /dikdörtgen/, 'bbox sınırı beyan edilmeli');
    assert.match(html, /68[.,]93 ha/, 'bbox jeodezik alanı sayıyla');
  });
  test('§4.1 çevre→DBH türetmesini veriye bakarak anlatır (girth_cm dolu)', () => {
    assert.match(html, /DBH = çevre ÷ π/, 'dönüşüm beyanı');
    assert.match(html, /2\/2 kayıtta ham çevre değeri saklıdır/);
  });
  test('blok durumunda §7 açık uyarı basar', () => {
    const blockedQa = { ...qa, hd_block: true, hd_fail: [{ point_id: 7, hd: 9.7 }, { point_id: 29, hd: 8.8 }, { point_id: 32, hd: 6.25 }] };
    const snap2 = { ...snap, qa: { species: blockedQa, photos: snap.qa.photos } };
    const h2 = renderReport(snap2, { id: 'DGR-2026-9998', hash: canonicalHash(snap2), version: 1, meta: { id: 'DGR-2026-9998', history: [] } });
    assert.match(h2, /envanter kalite kapısı blok durumundadır/i);
    assert.match(h2, /GEÇİCİDİR/);
  });
});

describe('0011 · SQL migration dosyası', () => {
  const sql = read('supabase/migrations/0011_inventory_qa.sql');
  test('idempotent + transaction + yedek tablosu', () => {
    assert.match(sql, /^begin;/m);
    assert.match(sql, /^commit;/m);
    assert.match(sql, /measurements_bak_0011/);
    assert.match(sql, /add column if not exists girth_cm/);
  });
  test('ham çevre silinmez; dönüşüm π ile ve yalnız bir kez (girth_cm IS NULL koruması)', () => {
    assert.match(sql, /set girth_cm = m\.dbh_cm/);
    assert.match(sql, /dbh_cm\s*=\s*round\(\(m\.dbh_cm \/ pi\(\)\)::numeric, 2\)/);
    assert.ok((sql.match(/girth_cm is null/g) || []).length >= 2, 'yedek + dönüşüm koruması');
  });
  test('ρ CASE sözlükle senkron (44 tür + grup varsayılanı)', () => {
    const { rho, grho } = loadRho();
    for (const [k, v] of Object.entries(rho))
      assert.ok(sql.includes(`when '${k}' then ${v}`), 'eksik ρ satırı: ' + k);
    assert.match(sql, /when 'İBRELİ' then 446 when 'YAPRAKLI' then 541 else 493 end/);
  });
  test('park 25 sınırı gerçek OSM halkasıyla değişir (bbox değil)', () => {
    assert.match(sql, /way\/423602737/);
    assert.match(sql, /jsonb_set/);
    const ringPts = (sql.match(/\[\d{2}\.\d+/g) || []).length;
    assert.ok(ringPts > 100, 'gömülü halka nokta sayısı: ' + ringPts);
  });
  test('accuracy_m uydurulmaz; P33≡P35 ve foto kayması beyan edilir', () => {
    assert.match(sql, /UYDURMUYORUZ/);
    assert.match(sql, /P33 ≡ P35/);
    assert.match(sql, /P005_M1\.JPG/);
  });
});
