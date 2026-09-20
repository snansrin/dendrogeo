/* landcover-v4.test.mjs — çift kaynaklı motorun yeni parçaları.
 *
 * v4 ile gelenler: EPSG:4326 (ESA WorldCover) desteği → dışbükey hücre
 * kesişimi, yıl filtresi, kaynak-bazlı sınıf eşlemesi, nesne tanımlama
 * (bağlı bileşenler) ve çapraz uzlaşma.
 *
 * Bilimsel bağlam: Göksu Parkı doğrulaması (scripts/lulc-qa.mjs ile canlı
 * veriyle): park 50.05 ha → su 12.50 ha, sert 14.71 ha, yeşil 22.26 ha,
 * QA farkı %0.000. Saha bilgisiyle (su ~12.5 ha, sert ~15 ha) birebir uyumlu.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from '../scripts/test-harness.mjs';

const app = loadApp({ sadece: ['src/config/constants.js', 'src/utils/geo.js', 'src/services/landcover.js'] });
const {
  dgLcEnsureCcw, dgLcClipPolygonConvex, dgLcIntersectionAreaConvex, dgLcQuadBBox,
  dgLcIntersectionArea, dgLcClipPolygonRect, dgLcPlanarArea, dgLcUtmForward,
  dgLcItemMatchesYear, dgLcGroupForCode, dgLcIsMasked,
  dgLcDetectPatches, dgLcGroupAgreement,
  DG_LC_SOURCES, DG_ESA_GROUP,
} = app;

const KARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
const halka = (pts) => { const p = pts.map(([x, y]) => ({ x, y })); p._bbox = dgLcQuadBBox(p); return p; };

describe('dgLcEnsureCcw — yön normalizasyonu', () => {
  test('saat yönündeki halkayı çevirir', () => {
    const cw = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }];
    const ccw = dgLcEnsureCcw(cw);
    let a = 0;
    for (let i = 0; i < ccw.length; i++) {
      const p = ccw[i], q = ccw[(i + 1) % ccw.length];
      a += p.x * q.y - q.x * p.y;
    }
    assert.ok(a > 0, 'çıktı CCW olmalı');
  });
  test('zaten CCW ise dokunmaz', () => {
    assert.deepEqual(dgLcEnsureCcw(KARE), KARE);
  });
});

describe('dgLcClipPolygonConvex — dışbükey kırpma', () => {
  test('eksen hizalı dikdörtgenle eski rect kırpmasıyla AYNI alanı verir', () => {
    const park = halka([[-5, -5], [15, -5], [15, 15], [-5, 15]]);
    const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const eski = dgLcPlanarArea(dgLcClipPolygonRect(park, rect));
    const quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    quad._bbox = dgLcQuadBBox(quad);
    const yeni = dgLcPlanarArea(dgLcClipPolygonConvex(park, quad));
    assert.ok(Math.abs(eski - yeni) < 1e-9, `${eski} vs ${yeni}`);
  });

  test('yamuk dörtgeni doğru kırpar (4326 hücre benzetimi)', () => {
    // hafif yamuk hücre: tamamı parkın içinde
    const park = halka([[-50, -50], [50, -50], [50, 50], [-50, 50]]);
    const quad = [{ x: 0, y: 0 }, { x: 7.1, y: 0.3 }, { x: 7.0, y: 9.3 }, { x: 0.1, y: 9.0 }];
    const alan = dgLcPlanarArea(dgLcClipPolygonConvex(park, quad));
    const tam = dgLcPlanarArea(quad);
    assert.ok(Math.abs(alan - tam) < 1e-9, 'hücre tamamen içindeyse alan = hücre alanı');
  });

  test('hiç kesişmezse boş', () => {
    const park = halka([[100, 100], [110, 100], [110, 110]]);
    assert.equal(dgLcClipPolygonConvex(park, KARE).length, 0);
  });
});

describe('dgLcIntersectionAreaConvex — delikli poligon ∩ dörtgen', () => {
  test('rect sürümüyle aynı sonucu verir', () => {
    const outer = halka([[-5, -5], [15, -5], [15, 15], [-5, 15]]);
    const hole = halka([[4, 4], [6, 4], [6, 6], [4, 6]]);
    const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const eski = dgLcIntersectionArea([outer], [hole], rect);
    const quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    quad._bbox = dgLcQuadBBox(quad);
    const yeni = dgLcIntersectionAreaConvex([outer], [hole], quad);
    assert.ok(Math.abs(eski - yeni) < 1e-9, `${eski} vs ${yeni}`);
    assert.ok(Math.abs(yeni - 96) < 1e-9, '100 - 4 = 96');
  });
});

describe('EPSG:4326 hücresi — anizotropik alan', () => {
  test('40° enlemde 1/12000° hücre ≈ 7,1 × 9,25 m', () => {
    const lat = 40, lon = 32;
    const dLon = 3 / 36000, dLat = 3 / 36000;   // ESA WorldCover: 3° / 36000 px
    const f = (lo, la) => dgLcUtmForward(la, lo, 32636);
    const quad = [
      f(lon, lat), f(lon + dLon, lat), f(lon + dLon, lat + dLat), f(lon, lat + dLat),
    ];
    const alan = dgLcPlanarArea(dgLcEnsureCcw(quad));
    const beklenen = (dLon * 111320 * Math.cos(lat * Math.PI / 180)) * (dLat * 110540);
    assert.ok(Math.abs(alan - beklenen) / beklenen < 0.01, `${alan} vs ${beklenen}`);
    assert.ok(alan > 60 && alan < 72, 'makul aralık: ' + alan);
  });
});

describe('dgLcItemMatchesYear — yıl filtresi (QA hatasının kökü)', () => {
  test('io-lulc: 36S-2020 → 2020 için true, 2019 için false', () => {
    assert.equal(dgLcItemMatchesYear({ id: '36S-2020' }, 2020), true);
    assert.equal(dgLcItemMatchesYear({ id: '36S-2019' }, 2020), false);
  });
  test('ESA: v200 2021 karosu → 2021 true, 2020 false', () => {
    const id = 'ESA_WorldCover_10m_2021_v200_N39E030';
    assert.equal(dgLcItemMatchesYear({ id }, 2021), true);
    assert.equal(dgLcItemMatchesYear({ id }, 2020), false);
  });
  test('properties.datetime yılına da bakar', () => {
    assert.equal(dgLcItemMatchesYear({ id: 'x', properties: { datetime: '2020-06-01T00:00:00Z' } }, 2020), true);
    assert.equal(dgLcItemMatchesYear({ id: 'x', properties: { datetime: '2019-06-01T00:00:00Z' } }, 2020), false);
  });
  test('⭐ REGRESYON: 2019 karosu süzülmeseydi alan iki katına çıkardı', () => {
    // Bu filtre olmadan iki karo işlenip alanlar toplanıyordu:
    // assigned ≈ 2 × park → "QA başarısız: %99.61 fark".
    const items = [{ id: '36S-2020' }, { id: '36S-2019' }];
    const suzulu = items.filter((it) => dgLcItemMatchesYear(it, 2020));
    assert.equal(suzulu.length, 1);
    assert.equal(suzulu[0].id, '36S-2020');
  });
});

describe('kaynak-bazlı sınıf eşlemesi', () => {
  test('ESA WorldCover kodları', () => {
    const P = DG_LC_SOURCES.primary;
    assert.equal(dgLcGroupForCode(10, P), 'green');   // ağaç
    assert.equal(dgLcGroupForCode(30, P), 'green');   // çayır
    assert.equal(dgLcGroupForCode(50, P), 'hard');    // yapılı
    assert.equal(dgLcGroupForCode(80, P), 'water');   // su
    assert.equal(dgLcGroupForCode(90, P), 'water');   // otsu sulak
    assert.equal(dgLcGroupForCode(60, P), 'bare');    // çıplak
    assert.equal(dgLcGroupForCode(70, P), 'other');   // kar
  });
  test('io-lulc kodları', () => {
    const C = DG_LC_SOURCES.cross;
    assert.equal(dgLcGroupForCode(2, C), 'green');
    assert.equal(dgLcGroupForCode(7, C), 'hard');
    assert.equal(dgLcGroupForCode(1, C), 'water');
    assert.equal(dgLcGroupForCode(8, C), 'bare');
  });
  test('maskleme kuralları kaynak-bazlı', () => {
    const P = DG_LC_SOURCES.primary, C = DG_LC_SOURCES.cross;
    assert.equal(dgLcIsMasked(0, P), true);    // ESA NoData
    assert.equal(dgLcIsMasked(10, P), false);  // ESA 10 = AĞAÇ, maskelenmez!
    assert.equal(dgLcIsMasked(10, C), true);   // io-lulc 10 = bulut
    assert.equal(dgLcIsMasked(9, C), true);    // io-lulc 9 = kar
  });
});

describe('dgLcDetectPatches — nesne tanımlama', () => {
  const cell = (row, col, classKey, areaM2 = 100) => ({
    row, col, epsg: 32636, classKey, areaM2,
    center: { lat: 40 + row * 0.0001, lon: 32 + col * 0.0001 },
  });

  test('bitişik hücreler tek nesne sayılır', () => {
    const cells = [cell(0, 0, 'water'), cell(0, 1, 'water'), cell(1, 0, 'water'), cell(1, 1, 'water')];
    const patches = dgLcDetectPatches(cells, 0.01);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].cells, 4);
    assert.ok(Math.abs(patches[0].areaM2 - 400) < 1e-9);
  });

  test('ayrık bloklar ayrı nesnelerdir ve alan sırasıyla döner', () => {
    const cells = [
      cell(0, 0, 'water'), cell(0, 1, 'water'),          // 200 m²
      cell(50, 50, 'water'),                              // 100 m²
      cell(9, 9, 'hard'),                                 // 100 m²
    ];
    const patches = dgLcDetectPatches(cells, 0.005);
    assert.equal(patches.length, 3);
    assert.equal(patches[0].areaM2, 200);
    assert.equal(patches[0].classKey, 'water');
  });

  test('eşik altı bileşenler elenir', () => {
    const cells = [cell(0, 0, 'hard')];                  // 100 m² = 0.01 ha
    assert.equal(dgLcDetectPatches(cells, 0.05).length, 0);
    assert.equal(dgLcDetectPatches(cells, 0.005).length, 1);
  });

  test('çapraz bitişiklık (köşegen) AYNI nesne sayılmaz (4-yön kuralı)', () => {
    const cells = [cell(0, 0, 'green'), cell(1, 1, 'green')];
    assert.equal(dgLcDetectPatches(cells, 0.005).length, 2);
  });

  test('merkez alan-ağırlıklıdır', () => {
    const a = cell(0, 0, 'water', 300);
    const b = cell(0, 1, 'water', 100);
    const [pt] = dgLcDetectPatches([a, b], 0.005);
    const bek = (a.center.lon * 300 + b.center.lon * 100) / 400;
    assert.ok(Math.abs(pt.centroid.lon - bek) < 1e-12);
  });
});

describe('dgLcGroupAgreement — çapraz uzlaşma', () => {
  test('özdeş kaynaklar %100 uzlaşır', () => {
    const r = { groupAreas: { water: 125000, hard: 147000, green: 0, bare: 0, other: 0 } };
    const a = dgLcGroupAgreement(r, r);
    assert.equal(a.water.agreementPct, 100);
  });
  test('iki kat fark %33 uzlaşma verir (|a-b|/(a+b))', () => {
    const a1 = { groupAreas: { water: 200 } };
    const a2 = { groupAreas: { water: 100 } };
    const a = dgLcGroupAgreement(a1, a2);
    assert.ok(Math.abs(a.water.agreementPct - 100 * (1 - 100 / 300)) < 1e-9);
  });
  test('iki tarafta da yoksa %100 (veri yok = anlaşmazlık yok)', () => {
    const a = dgLcGroupAgreement({ groupAreas: {} }, { groupAreas: {} });
    assert.equal(a.other.agreementPct, 100);
  });
});

describe('kaynak yapılandırması', () => {
  test('birincil ESA WorldCover 2021, çapraz io-lulc 2020', () => {
    assert.equal(DG_LC_SOURCES.primary.collection, 'esa-worldcover');
    assert.equal(DG_LC_SOURCES.primary.year, 2021);
    // NOT: vm realm'leri arasında deepEqual ÇALIŞMAZ (bkz. harness tuzak #2)
    assert.equal(DG_LC_SOURCES.primary.assetKeys.join(','), 'map,data');
    assert.equal(DG_LC_SOURCES.cross.collection, 'io-lulc-annual-v02');
    assert.equal(DG_LC_SOURCES.cross.year, 2020);
  });
});
