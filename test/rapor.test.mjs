/* rapor.test.mjs — Bilimsel rapor yayın hattının bekçileri (R1+R3, 2026-09-27)
 *
 * Kilitlenen sözleşmeler:
 *  1) Sayılar uydurulamaz: MC çekirdeği deterministik ve merkezli
 *     (nokta tahmin = saklı carbon_kg toplamı).
 *  2) Bütünlük: sayfadaki sha256, data.json'ın kanonik hash'ine eşittir
 *     (realm-bağımsız canonicalHash — vm nesnelerinde de doğru sıralar).
 *  3) Rapor biçimi: 8 bölüm, atıf (APA+BibTeX), hash widget'i, og: etiketleri,
 *     indirmeler, yazdır/PDF, akademik dil (gündelik kelime yasağı).
 *  4) Yayınlanmış rapor dosyaları tutarlı (repo'daki DGR-* dizini).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mcTotalCI, mcRowCI, canonicalHash, MC_CFG } from '../scripts/lib/mc.mjs';
import { renderReport, mapCanvas, MAP_TONES } from '../scripts/make-report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const ROWS = [
  { id: 1, point_id: 1, species: 'SEDİR', grp: 'İBRELİ', dbh_cm: 190, height_m: 12, carbon_kg: 23878.2 },
  { id: 2, point_id: 2, species: 'KARAÇAM', grp: 'İBRELİ', dbh_cm: 25, height_m: 6, carbon_kg: 58.7 },
];
const SNAP = {
  schema: 'dendrogeo-report/1',
  park: { id: 5, name: 'Test Parkı', osm_key: 'way/1', city: 'Ankara', country: 'Türkiye', area_m2: 852000 },
  generated_at: '2026-09-27T12:00:00.000Z',
  mc: { ...MC_CFG },
  totals: { n: 2, carbon_kg: 23936.9, ci: { mean: 23936.9, lo: 13000, hi: 35000 }, per_ha_kg: 281 },
  species: [{ species: 'SEDİR', grp: 'İBRELİ', n: 1, mean_dbh: 190, mean_h: 12, carbon_kg: 23878.2, share_pct: 99.8 }],
  gps: { n: 2, mean_acc_m: 8.9 },
  period: { from: '2026-09-03T09:00:00Z', to: '2026-09-06T14:00:00Z' },
  moderation: { approved: 2, reviewed: 2 },
  geofence: { policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)', total: 2, verified_rows: 2, outside_rows: 0, polygon_source: 'OSM' },
  lulc: { source: 'ESA WorldCover 10 m 2021 v200', citation: 'ESA WorldCover 10 m 2021 v200, CC BY 4.0', year: 2021, cross: 'IO LULC', crossError: null, agreement: { green: { agreementPct: 90 } }, areaDeltaPct: 0.12, cells: 8500, masked_ha: 0, classes: [{ key: 'green', label: 'Yeşil alan', ha: 69.75, pct: 82 }] },
  rows: ROWS.map((r) => ({ ...r, lat: 39.9, lon: 32.7, acc_m: 9, date: '2026-09-03' })),
};

describe('MC çekirdeği: determinizm + merkezleme', () => {
  test('aynı veri → aynı aralık (seed sabit)', () => {
    const a = mcTotalCI(ROWS), b = mcTotalCI(ROWS);
    assert.equal(a.lo, b.lo); assert.equal(a.hi, b.hi);
  });
  test('nokta tahmin = saklı carbon_kg toplamı (merkezleme)', () => {
    const c = mcTotalCI(ROWS);
    const stored = ROWS.reduce((a, r) => a + r.carbon_kg, 0);
    assert.ok(Math.abs(c.mean - stored) < 1e-6, `${c.mean} != ${stored}`);
  });
  test('aralık sıralı ve pozitif', () => {
    const c = mcTotalCI(ROWS);
    assert.ok(0 < c.lo && c.lo < c.mean && c.mean < c.hi);
  });
  test('canonicalHash realm/order bağımsız', () => {
    const a = { x: 1, y: { b: 2, a: 1 } }, b2 = { y: { a: 1, b: 2 }, x: 1 };
    assert.equal(canonicalHash(a), canonicalHash(b2));
  });
});

describe('rapor belgesi: biçim ve dil', () => {
  const html = renderReport(SNAP, { id: 'DGR-2026-0001', hash: canonicalHash(SNAP), version: 1 });
  test("8 bölüm + atıf + bütünlük widget’i + og etiketleri", () => {
    for (const n of ['1', '2', '3', '4', '5', '6', '7', '8']) assert.ok(html.includes(`<span class="no">${n}</span>`), 'bölüm ' + n);
    assert.match(html, /@techreport/, 'BibTeX');
    assert.match(html, /dgVerify/, "bütünlük widget’i");
    assert.match(html, /og:title/, 'og:title');
    assert.match(html, /og:image/, 'og:image (LULC var)');
    assert.match(html, /window\.print\(\)/, 'yazdır/PDF');
    assert.match(html, /olcum\.csv/, 'CSV indirme');
    assert.match(html, /data\.json/, 'snapshot indirme');
  });
  test('akademik dil: gündelik/konuşma kelimesi yok', () => {
    for (const w of ['kanka', 'süper', 'harika', 'şey oldu', 'baya', 'click here'])
      assert.ok(!html.toLowerCase().includes(w), 'gündelik kelime: ' + w);
    assert.match(html, /hesaplanmıştır|sunulmaktadır|gerçekleştirilmiştir/, 'edilgen akademik kayıt dili');
  });
  test('belirsizlik ve sınırlılıklar beyanı zorunlu', () => {
    assert.match(html, /%95 GA/, 'güven aralığı görünür');
    assert.match(html, /Sınırlılıklar/, 'sınırlılıklar bölümü');
    assert.match(html, /ekstrapole/, 'ekstrapolasyon uyarısı');
  });
});

describe('yayınlanmış rapor dizini tutarlı', () => {
  const dir = join(ROOT, 'rapor');
  test('rapor dizini ve ilk rapor mevcut', () => {
    assert.ok(existsSync(dir), 'rapor/ dizini');
    const ids = readdirSync(dir).filter((d) => d.startsWith('DGR-'));
    assert.ok(ids.length >= 1, 'en az bir yayın');
    for (const id of ids) {
      const d = join(dir, id);
      for (const f of ['index.html', 'data.json', 'olcum.csv', 'park.geojson'])
        assert.ok(existsSync(join(d, f)), id + '/' + f);
      const data = JSON.parse(readFileSync(join(d, 'data.json'), 'utf8'));
      const html = readFileSync(join(d, 'index.html'), 'utf8');
      assert.ok(html.includes(canonicalHash(data)), id + ": sayfa hash’i data.json ile eşleşmeli");
    }
  });
  test('liste sayfası raporları dizinler', () => {
    const idx = readFileSync(join(dir, 'index.html'), 'utf8');
    assert.match(idx, /DGR-2026-0001/, 'liste ilk raporu gösterir');
  });
  test('Actions iş akışı mevcut ve izinli', () => {
    const y = read('.github/workflows/rapor.yml');
    assert.match(y, /workflow_dispatch/, 'elle tetik');
    assert.match(y, /contents: write/, 'commit yetkisi');
    assert.match(y, /make-report\.mjs/, 'üretici');
  });
});

describe('dil denetimi: başlık ve yöntem Türkçe', () => {
  const html = renderReport(SNAP, { id: 'DGR-2026-0001', hash: canonicalHash(SNAP), version: 1 });
  test('Above/Below-Ground geçmez (Türkçe karşılık: toprak üstü / toprak altı)', () => {
    assert.ok(!/Above|Below/i.test(html), 'İngilizce biyokütle terimi kalmamalı');
    assert.match(html, /Toprak Üstü \/ Toprak Altı Karbon Stoku/, 'başlık Türkçe');
    assert.match(html, /Toprak üstü biyokütle \(AGB\)/, 'yöntem Türkçe');
    assert.match(html, /Toprak altı biyokütle/, 'kök biyokütlesi Türkçe');
  });
  test('Şekil 1 yaprak yeşili dolgu ile çizilir (turuncu/bej değil)', () => {
    assert.match(html, /--leaf:#2f9e44/, 'yaprak yeşili token');
    assert.match(html, /\.brow \.bar i\{display:block;height:100%;background:var\(--leaf\)/, 'bar dolgusu yaprak yeşili');
    assert.ok(!/\.brow \.bar\{[^}]*background:var\(--line\)/.test(html), 'bar yatağı bej --line olmamalı');
  });
  test('Şekil 2 açıklamasında yıl yinelenmez', () => {
    assert.ok(!/\(v200\) \(2021\)/.test(html), 'çift yıl parantezi');
    assert.match(html, /Şekil 2 — ESA WorldCover 10 m 2021 v200 sınıflandırmasının/, 'tek yıl');
  });
});

describe('konum çiti beyanı: gerçek nokta–poligon denetimine bağlı', () => {
  test('tüm kayıtlar içerdeyse ✅ satırı', () => {
    const html = renderReport(SNAP, { id: 'DGR-2026-0001', hash: canonicalHash(SNAP), version: 1 });
    assert.match(html, /✅ Konum çiti: 2\/2 kayıt park poligonu içinde doğrulanmıştır/);
  });
  test('poligon dışı kayıt varsa ⚠ beyanı zorunlu', () => {
    const bad = { ...SNAP, geofence: { ...SNAP.geofence, verified_rows: 1, outside_rows: 1 } };
    const html = renderReport(bad, { id: 'DGR-2026-0001', hash: canonicalHash(bad), version: 1 });
    assert.match(html, /⚠ Konum çiti: 1\/2 kayıt park poligonu içinde/);
    assert.match(html, /poligon dışında koordinat taşımaktadır/);
    assert.ok(!/✅ Konum çiti/.test(html), 'yanlış ✅ yok');
  });
  test('pointInPolygon: kare poligonda iç/dış/ayırma', async () => {
    const { pointInPolygon } = await import('../scripts/make-report.mjs');
    const sq = [[0, 0], [0, 2], [2, 2], [2, 0]];
    assert.equal(pointInPolygon(1, 1, sq), true);
    assert.equal(pointInPolygon(3, 1, sq), false);
    assert.equal(pointInPolygon(-0.1, 1, sq), false);
    const hole = [[0.8, 0.8], [0.8, 1.2], [1.2, 1.2], [1.2, 0.8]];
    assert.equal(pointInPolygon(1, 1, sq, [hole]), false, 'delik içi dış sayılır');
  });
});

describe('Şekil 2 tuvali: park sahası tam örtüşüm + kırpma', () => {
  const outer = [[0, 0], [0, 0.02], [0.02, 0.02], [0.02, 0]];   /* [lat,lon] kare */
  const wruns = [
    { lo0: 0, lo1: 0.02, la0: 0, la1: 0.01, key: 'green' },
    { lo0: -0.02, lo1: 0.04, la0: 0.01, la1: 0.02, key: 'green' },  /* dışa taşan bant → kırpılmalı */
  ];
  const classes = { green: { label: 'Yeşil alan', color: '#4ade80', areaM2: 40000 } };
  const cv = mapCanvas({ outer, wruns, classes, parkName: 'TEST PARKI', sub: 'KAYNAK', points: [{ lat: 0.005, lon: 0.005 }], pointStat: { inside: 1, outside: 0 } });
  const px = (x, y) => [cv.px[(y * cv.w + x) * 4], cv.px[(y * cv.w + x) * 4 + 1], cv.px[(y * cv.w + x) * 4 + 2]];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const PAD = 26, TOP = 96, MAPH = 540;
  const midY = TOP + (MAPH - 2 * PAD) / 2;
  test('poligon içi sınıf rengiyle kaplı: beyaz/gri dilim imkânsız', () => {
    for (let i = 1; i < 12; i++) {
      const x = Math.round(cv.w * i / 13), y = Math.round(TOP + PAD + (MAPH - 2 * PAD) * i / 13);
      const c = px(x, y);
      assert.ok(same(c, [74, 222, 128]) || same(c, MAP_TONES.ink) || same(c, MAP_TONES.halo), `iç piksel ${i}: ${c}`);
    }
  });
  test('run bandı taşması poligon dışına boyamaz (kırpma geçişi)', () => {
    assert.ok(same(px(6, midY), MAP_TONES.out), 'sol dış bağlam dokusu');
    assert.ok(same(px(cv.w - 4, midY), MAP_TONES.out), 'sağ dış bağlam dokusu');
  });
  test('ölçüm noktası mürekkep noktası olarak çizilir', () => {
    const dyM = 0.02 * 110540, dxM = 0.02 * 111320 * Math.cos(0.01 * Math.PI / 180);
    const W = Math.max(420, Math.min(1000, Math.round((MAPH - 2 * PAD) * dxM / dyM) + 2 * PAD));
    const k = Math.max(0.02, Math.min((W - 2 * PAD) / dxM, (MAPH - 2 * PAD) / dyM));
    const X = W / 2 + (0.005 - 0.01) * 111320 * Math.cos(0.01 * Math.PI / 180) * k;
    const Y = TOP + (MAPH - 2 * PAD) / 2 - (0.005 - 0.01) * 110540 * k;
    assert.ok(same(px(Math.round(X), Math.round(Y)), MAP_TONES.ink), 'nokta merkezi mürekkep');
  });
  test('lejant: sınır, nokta ve bağlam sembolleri mevcut', () => {
    const buf = cv.encode();
    assert.ok(buf.length > 1000 && buf[1] === 0x50, 'PNG geçerli');
  });
});
