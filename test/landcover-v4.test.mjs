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
import { readFileSync } from 'node:fs';
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

describe('dgLcRenderReport — render yolu (TDZ regresyonu)', () => {
  /* "Cannot access 'R' before initialization" hatası SAHADA yakalandı;
   * render yolu test edilmiyordu. Bu blok hem rapor nesnesi hem ham result
   * nesnesiyle render'ın çökmediğini ve beklenen bölümleri ürettiğini kilitler. */
  const stub = () => {
    const o = {};
    Object.defineProperty(o, 'innerHTML', {
      set(v) { o._v = v; }, get() { return o._v || ''; },
    });
    return o;
  };
  const REPORT = {
    groupCounts: { water: 1900, green: 3458, hard: 2422 },
    groupAreasM2: { water: 125000, green: 222600, hard: 147100 },
    classifiedAreaM2: 500500, maskedAreaM2: 0, maskedCount: 0,
    sourceCells: 7780, rasterCoverageAreaM2: 500500,
    year: 2021, primaryLabel: 'ESA WorldCover 10 m · 2021 (v200)',
    primaryCitation: 'ESA', crossCitation: 'IO',
    agreement: { water: { primaryHa: 12.5, crossHa: 11.04, agreementPct: 94 } },
    crossError: null,
    patches: [{ group: 'water', areaHa: 12.47, cells: 1895, centroidLat: 39.99, centroidLon: 32.64 }],
  };
  const RAW = {
    groupCounts: { water: 1900 }, groupAreas: { water: 125000 },
    rawCounts: { 80: 1900 }, rawAreas: { 80: 125000 },
    classifiedAreaM2: 500500, maskedAreaM2: 0, maskedCount: 0,
    sourceCells: 7780, assignedAreaM2: 500500, cells: [], runs: [],
  };

  test('⭐ rapor nesnesiyle çökmez (TDZ kilidi)', () => {
    const rep = stub();
    assert.doesNotThrow(() => app.dgLcRenderReport(rep, REPORT, 500500));
    assert.ok(rep.innerHTML.length > 500);
  });

  test('ham result nesnesiyle de çökmez', () => {
    const rep = stub();
    assert.doesNotThrow(() => app.dgLcRenderReport(rep, RAW, 500500));
    assert.ok(rep.innerHTML.includes('12.50'), 'su alanı tabloda görünmeli');
  });

  test('tek blok: sınıf + uzlaşma + nesne bilgileri üretir', () => {
    const rep = stub();
    app.dgLcRenderReport(rep, REPORT, 500500);
    const h = rep.innerHTML;
    assert.ok(h.includes('Su'), 'sınıf adı');
    assert.ok(h.includes('12.50'), 'su ha değeri');
    assert.ok(h.includes('🔬 uzlaşma %94'), 'uzlaşma satır içinde');
    assert.ok(h.includes('🧩'), 'nesne özeti satır içinde');
  });

  test('QA eşiği aşılınca uyarı notu çıkar', () => {
    const rep = stub();
    const kotu = Object.assign({}, RAW, { assignedAreaM2: 1001000 });
    app.dgLcRenderReport(rep, kotu, 500500);
    assert.ok(rep.innerHTML.includes('QA farkı'));
  });

  test('rep yoksa sessizce döner', () => {
    assert.doesNotThrow(() => app.dgLcRenderReport(null, REPORT, 500500));
  });
});

describe('renk paleti ve şeffaflık (kullanıcı spesifikasyonu)', () => {
  const renkler = Object.fromEntries(
    // DG_LC_CLASSES vm realm'inden geliyor; düz okuma yeterli
    [['green', null], ['water', null], ['hard', null], ['bare', null], ['other', null]]
      .map(([k]) => [k, (app.DG_LC_CLASSES.find((c) => c.key === k) || {}).color])
  );

  test('yeşil = AÇIK yeşil, su = mavi, sert = gri, çıplak = kahverengi', () => {
    assert.equal(renkler.green, '#4ade80');
    assert.equal(renkler.water, '#3b82f6');
    assert.equal(renkler.hard, '#64748b');
    assert.equal(renkler.bare, '#8b5a2b');
  });

  test('kaynak kodunda şeffaflık değerleri duruyor (fill .38 / stroke .50)', () => {
    const src = readFileSync(new URL('../src/services/landcover.js', import.meta.url), 'utf8');
    assert.match(src, /fillOpacity:\.38/);
    assert.match(src, /opacity:\.60/);
  });
});

describe('⭐ TEK BLOK rapor (kullanıcı: "1 tane barlı ver, gerekli bilgiler içinde")', () => {
  const stub = () => {
    const o = {};
    Object.defineProperty(o, 'innerHTML', { set(v) { o._v = v; }, get() { return o._v || ''; } });
    return o;
  };
  const REPORT = {
    groupCounts: { water: 1900, green: 3458, hard: 2422 },
    groupAreasM2: { water: 125000, green: 222600, hard: 147100 },
    classifiedAreaM2: 500500, maskedAreaM2: 0, maskedCount: 0,
    sourceCells: 7780, rasterCoverageAreaM2: 500500,
    year: 2021, primaryLabel: 'ESA WorldCover 2021', primaryCitation: 'ESA',
    crossCitation: 'IO',
    agreement: { water: { primaryHa: 12.5, crossHa: 11.04, agreementPct: 94 },
                 green: { primaryHa: 22.26, crossHa: 0, agreementPct: 0 },
                 hard: { primaryHa: 14.71, crossHa: 39.01, agreementPct: 55 } },
    crossError: null,
    patches: [
      { group: 'water', areaHa: 12.47, cells: 1895 },
      { group: 'green', areaHa: 19.87, cells: 3061 },
      { group: 'green', areaHa: 1.10, cells: 176 },
    ],
  };

  test('tek bar bloğu: sınıf başına bar + ha + % + ayrıntı satırı', () => {
    const rep = stub();
    app.dgLcRenderReport(rep, REPORT, 500500);
    const h = rep.innerHTML;
    for (const [lab, ha, pct, hucre] of [
      ['Yeşil alan', '22.26', '%44.5', '3.458 hücre'],
      ['Su', '12.50', '%25.0', '1.900 hücre'],
      ['Sert zemin', '14.71', '%29.4', '2.422 hücre'],
    ]) {
      assert.ok(h.includes(lab), lab + ' satırı');
      assert.ok(h.includes(ha + ' ha'), lab + ' ha değeri');
      assert.ok(h.includes(pct), lab + ' yüzdesi');
      assert.ok(h.includes(hucre), lab + ' hücre sayısı');
    }
    // gerekli bilgiler aynı blokta: uzlaşma + nesne özeti
    assert.ok(h.includes('🔬 uzlaşma %94'), 'su uzlaşması satır içinde');
    assert.ok(h.includes('🧩 2 nesne'), 'yeşil nesne sayısı satır içinde');
    assert.ok(h.includes('en büyük 19.87 ha'), 'en büyük nesne satır içinde');
  });

  test('⭐ ayrı tablo/kalabalık YOK: tek blok, canvas yok, ek başlık yok', () => {
    const rep = stub();
    app.dgLcRenderReport(rep, REPORT, 500500);
    const h = rep.innerHTML;
    assert.ok(!h.includes('<th>'), 'hiç tablo başlığı yok (tablo kalabalığı bitti)');
    assert.ok(!h.includes('Çapraz doğrulama'), 'ayrı çapraz tablo yok');
    assert.ok(!h.includes('Nesne tanımlama'), 'ayrı nesne tablo yok');
    assert.ok(!h.includes('lcBarCanvas'), 'canvas yok');
    assert.equal((h.match(/<table/g) || []).length, 0, 'hiç <table> yok');
  });

  test('QA durumu başlık satırında', () => {
    const rep = stub();
    app.dgLcRenderReport(rep, REPORT, 500500);
    assert.ok(rep.innerHTML.includes('geometrik QA geçti'));
    const rep2 = stub();
    app.dgLcRenderReport(rep2, Object.assign({}, REPORT, { rasterCoverageAreaM2: 1001000 }), 500500);
    assert.ok(rep2.innerHTML.includes('QA farkı'), 'kötü QA uyarısı');
  });

  test('park/analiz/hücre/kapsam + kaynaklar alt bilgide', () => {
    const rep = stub();
    app.dgLcRenderReport(rep, REPORT, 500500);
    const h = rep.innerHTML;
    assert.ok(h.includes('50.05 ha') || h.includes('50.05'), 'analiz alanı');
    assert.ok(h.includes('7.780') || h.includes('7,780'), 'hücre sayısı: ' + (h.match(/[\d.,]+ hücre/g) || []).join('|'));
    assert.ok(h.includes('ESA'), 'kaynak atfı');
  });
});

describe('⭐ yumuşak vektör çizim — halka çıkarma + Chaikin (kare kare değil)', () => {
  const D = 0.0001;
  const cell = (row, col, classKey) => {
    const latTop = 40 - row * D, latBot = latTop - D;
    const lon0 = 32 + col * D, lon1 = lon0 + D;
    return {
      row, col, epsg: 4326, classKey, areaM2: 100,
      center: { lat: (latTop + latBot) / 2, lon: (lon0 + lon1) / 2 },
      quadWgs: [[lon0, latBot], [lon1, latBot], [lon1, latTop], [lon0, latTop]],
    };
  };
  const shoelaceDeg = (ring) => {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      a += p[1] * q[0] - q[1] * p[0];
    }
    return Math.abs(a) / 2;
  };

  test('2x2 blok → TEK dış halka, alanı 4 hücre', () => {
    const cells = [cell(0, 0, 'water'), cell(0, 1, 'water'), cell(1, 0, 'water'), cell(1, 1, 'water')];
    const rings = app.dgLcPatchRings(cells);
    assert.equal(rings.length, 1, 'deliksiz bloktan tek halka');
    // NOT: derece düzleminde shoelace ~1e-12 mutalakat hatası taşır;
    // 1e-8 mertebesinde alanlarda göreli tolerans 1e-3 ancak anlamlı.
    assert.ok(Math.abs(shoelaceDeg(rings[0]) - 4 * D * D) / (4 * D * D) < 1e-3,
      'halka alanı = 4 hücre: ' + shoelaceDeg(rings[0]));
  });

  test('3x3 halka (ortası boş) → dış halka + DELİK', () => {
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) continue;
      cells.push(cell(r, c, 'green'));
    }
    const rings = app.dgLcPatchRings(cells);
    assert.equal(rings.length, 2, 'dış halka + delik');
    const outer = rings[0], hole = rings[1];
    assert.ok(shoelaceDeg(outer) > shoelaceDeg(hole), 'dış halka daha büyük');
    assert.ok(Math.abs(shoelaceDeg(hole) - 1 * D * D) / (D * D) < 1e-3, 'delik = 1 hücre');
  });

  test('Chaikin: nokta sayısı 2 turda 4x, alan biraz içe büzülür', () => {
    const kare = [[40, 32], [40, 32.001], [39.999, 32.001], [39.999, 32]];
    const sm = app.dgLcSmoothRing(kare, 2);
    assert.equal(sm.length, 16);
    const a0 = shoelaceDeg(kare), a1 = shoelaceDeg(sm);
    assert.ok(a1 < a0 && a1 > a0 * 0.80, 'yumuşatma alanı sınırlı içe büker: ' + (a1 / a0));
  });

  test('detectPatches halkaları da döndürür (render nesneden çizer)', () => {
    const cells = [cell(0, 0, 'water'), cell(0, 1, 'water'), cell(1, 0, 'water'), cell(1, 1, 'water')];
    const [pt] = app.dgLcDetectPatches(cells, 0.005);
    assert.ok(Array.isArray(pt.rings) && pt.rings.length >= 1, 'rings alanı var');
    assert.ok(pt.rings[0].length >= 4, 'yumuşatılmış halka nokta sayısı');
  });

  test('dgLcRenderObjects: delikli nesne L.polygon([dış, delik]) olarak çizilir', () => {
    const captured = [];
    app.window.L = {
      layerGroup: () => ({ addTo: () => ({}) }),
      polygon: (latlngs, opts) => { captured.push(latlngs); return { addTo() {} }; },
      canvas: () => ({}),
    };
    app.map = { removeLayer() {} };
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) continue;
      cells.push(cell(r, c, 'green'));
    }
    const [pt] = app.dgLcDetectPatches(cells, 0.005);
    app.dgLcRenderObjects([pt]);
    assert.equal(captured.length, 1, 'tek poligon');
    assert.equal(captured[0].length, 2, 'dış halka + delik');
    for (const ring of captured[0]) for (const ll of ring) {
      assert.ok(ll[0] > 39.99 && ll[0] < 40.01, 'lat aralık: ' + ll[0]);
      assert.ok(ll[1] > 31.99 && ll[1] < 32.01, 'lon aralık: ' + ll[1]);
    }
    app.map = undefined;
    app.window.L = undefined;
  });

  test('canary: kare bant render kodu tamamen kalktı', () => {
    const src = readFileSync(new URL('../src/services/landcover.js', import.meta.url), 'utf8');
    assert.ok(!src.includes('dgLcRenderRuns'), 'run bant render fonksiyonu yok');
    assert.match(src, /dgLcRenderObjects\(patches\)/, 'analyze nesneleri çiziyor');
  });
});

describe('v8: alan korumalı yumuşatma + yeşil alan API\'si', () => {
  const D = 0.0001;
  const cell = (row, col, classKey) => {
    const latTop = 40 - row * D, latBot = latTop - D;
    const lon0 = 32 + col * D, lon1 = lon0 + D;
    return {
      row, col, epsg: 4326, classKey, areaM2: 100,
      center: { lat: (latTop + latBot) / 2, lon: (lon0 + lon1) / 2 },
      quadWgs: [[lon0, latBot], [lon1, latBot], [lon1, latTop], [lon0, latTop]],
    };
  };
  const area = (ring) => Math.abs(app.dgLcRingArea(ring));

  test('⭐ yumuşatılmış halka alanı ham halkayla aynı (sınırlar uzaklaşmaz)', () => {
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if ((r === 2 && c === 2)) continue;   // delikli ve girintili şekil
      cells.push(cell(r, c, 'green'));
    }
    const [pt] = app.dgLcDetectPatches(cells, 0.005);
    assert.ok(pt.ringsRaw && pt.ringsRaw.length >= 1, 'ham halkalar saklı');
    assert.ok(pt.rings.length === pt.ringsRaw.length);
    const a0 = area(pt.ringsRaw[0]), a1 = area(pt.rings[0]);
    assert.ok(Math.abs(a1 - a0) / a0 < 0.02,
      'alan korunmalı: ham ' + a0 + ' yumuşak ' + a1);
    assert.notEqual(pt.rings[0].length, pt.ringsRaw[0].length,
      'yumuşatma gerçekten uygulanmış olmalı');
  });

  test('nokta-halka testi: ışın yöntemi doğru', () => {
    const kare = [[40, 32], [40, 32.001], [39.999, 32.001], [39.999, 32]];
    assert.equal(app.dgLcPointInRing(39.9995, 32.0005, kare), true);
    assert.equal(app.dgLcPointInRing(40.001, 32.0005, kare), false);
    assert.equal(app.dgLcPointInRing(39.9995, 32.002, kare), false);
  });

  test('delikli halka: delik içindeki nokta YEŞİL değil', () => {
    const outer = [[40, 32], [40, 32.003], [39.997, 32.003], [39.997, 32]];
    const hole = [[39.999, 32.001], [39.999, 32.002], [39.998, 32.002], [39.998, 32.001]];
    assert.equal(app.dgLcPointInRings(39.9975, 32.0005, [outer, hole]), true);
    assert.equal(app.dgLcPointInRings(39.9985, 32.0015, [outer, hole]), false);
  });

  test('window.DG_LANDCOVER isGreen/hasGreen dışa açık', () => {
    assert.equal(typeof app.window.DG_LANDCOVER.isGreen, 'function');
    assert.equal(typeof app.window.DG_LANDCOVER.hasGreen, 'function');
    assert.equal(app.window.DG_LANDCOVER.hasGreen(), false, 'analiz yoksa hasGreen false');
    assert.equal(app.window.DG_LANDCOVER.isGreen(40, 32), false, 'analiz yoksa isGreen false');
  });
});

describe('v8: grid yeşil-alan kapısı + PNG dışa aktarım (canary)', () => {
  /* Faz 4: eski gridplan.js üç modüle bölündü — canary aynı desenleri yeni
   * dosyalarda arıyor (geometry=kapı, panel=UI anahtarı, export=PNG). */
  const src = [
    readFileSync(new URL('../src/services/park-geometry.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/ui/park-panel.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/ui/park-export.js', import.meta.url), 'utf8'),
  ].join('\n');

  test('isCellValid yeşil-alan kapısını içeriyor', () => {
    assert.match(src, /DG_GREEN_ONLY&&/);
    assert.match(src, /window\.DG_LANDCOVER\.isGreen\(cLat/);
  });

  test('UI: chkGreenOnly anahtarı var ve varsayılan AÇIK', () => {
    assert.match(src, /id="chkGreenOnly" checked onchange="setGreenOnly\(this\.checked\)"/);
    assert.match(src, /function setGreenOnly\(v\)/);
  });

  test('⭐ downloadParkImage TANIMLI (ölü buton regression kilidi)', () => {
    assert.match(src, /function downloadParkImage\(\)\{/);
    assert.match(src, /window\.downloadParkImage=downloadParkImage;/);
    assert.match(src, /cv\.toBlob\(/, 'canvas PNG üretimi');
    assert.ok(!src.includes('leaflet-image'), 'karo bazlı bağımlılık yok');
  });

  test('PNG katman anahtarları okunuyor (grid/wp/cover)', () => {
    assert.match(src, /chk\("chkPngGrid"\)/);
    assert.match(src, /chk\("chkPngWp"\)/);
    assert.match(src, /chk\("chkPngCover"\)/);
  });
});

describe('v9: sapma düzeltmesi + yapay havuz rafinasyonu + PNG park kıpı', () => {
  const srcLc = readFileSync(new URL('../src/services/landcover.js', import.meta.url), 'utf8');
  /* Faz 4: waypoint üretimi grid-engine.js'te, PNG kırpma ui/park-export.js'te */
  const srcGp = [
    readFileSync(new URL('../src/services/grid-engine.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/ui/park-export.js', import.meta.url), 'utf8'),
  ].join('\n');

  test('⭐ 4326 köşeleri hücre merkezi DEĞİL gerçek köşe (sapma kilidi)', () => {
    assert.match(srcLc, /c0=\{lat:latBot,lon:lon0\}/);
    assert.match(srcLc, /c2=\{lat:latTop,lon:lon1\}/);
    // eski hata: inv() 4326'da argümanı yok sayıyordu
    assert.ok(!srcLc.includes('isUtm?dgLcUtmInverse(p.x,p.y,analysisEpsg):{lat:(meta.maxY'),
      'eski sapmalı inv() geri gelmemeli');
  });

  test('⭐ dgLcRefineWater: yapay havuz hücreleri suya geçer', () => {
    const D = 0.0001;
    const cell = (row, col, classKey) => {
      const latTop = 40 - row * D, latBot = latTop - D;
      const lon0 = 32 + col * D, lon1 = lon0 + D;
      return { row, col, classKey, areaM2: 100, classCode: 50,
        center: { lat: (latTop + latBot) / 2, lon: (lon0 + lon1) / 2 } };
    };
    const result = {
      cells: [cell(0, 0, 'hard'), cell(0, 1, 'green'), cell(1, 0, 'water')],
      groupCounts: { hard: 1, green: 1, water: 1 },
      groupAreas: { hard: 100, green: 100, water: 100 },
      maskedCount: 0, maskedAreaM2: 0, classifiedAreaM2: 300,
    };
    // havuz: (0,0) hücresini kapsayan küçük kare
    const pool = [[39.99990, 32.00000], [39.99990, 32.00010], [39.99999, 32.00010], [39.99999, 32.00000]];
    const n = app.dgLcRefineWater(result, [pool]);
    assert.equal(n, 1, 'yalnız havuz içindeki hücre değişmeli');
    assert.equal(result.cells[0].classKey, 'water');
    assert.equal(result.cells[0].waterRefined, true);
    assert.equal(result.groupCounts.hard, 0);
    assert.equal(result.groupCounts.water, 2);
    assert.equal(result.groupAreas.water, 200);
    assert.equal(result.cells[2].classKey, 'water', 'zaten su olan dokunulmaz');
  });

  test('rafine edilecek su yoksa sayaçlar değişmez', () => {
    const result = {
      cells: [{ row: 0, col: 0, classKey: 'green', areaM2: 100, center: { lat: 41, lon: 33 } }],
      groupCounts: { green: 1 }, groupAreas: { green: 100 },
    };
    assert.equal(app.dgLcRefineWater(result, []), 0);
    assert.equal(app.dgLcRefineWater(result, [[[40, 32], [40, 32.001], [39.999, 32.001], [39.999, 32]]]), 0);
    assert.equal(result.groupCounts.green, 1);
  });

  test('analyze OSM su poligonu çekip rafinasyonu bağlıyor', () => {
    assert.match(srcLc, /dgLcFetchWaterPolygons\(bbox\)/);
    assert.match(srcLc, /waterRefinedCells:waterRefined/);
    assert.match(srcLc, /leisure\\?"=\\?"swimming_pool|leisure/);
  });

  test('⭐ waypoint: hücre merkezi hesaplanıyor (c.lat çökmesi geri gelemez)', () => {
    assert.match(srcGp, /lat:\+\(\(\(c\.s0\+c\.s1\)\/2\)\.toFixed\(6\)\)/);
    assert.ok(!srcGp.includes('lat:+c.lat.toFixed(6),'), 'eski çöken satır geri gelmemeli');
  });

  test('⭐ PNG: sınırlar yalnız park + çizim parka kırpılıyor', () => {
    assert.match(srcGp, /ctx\.clip\("evenodd"\)/);
    assert.ok(!srcGp.includes('if(opts.grid)(GRID_CELLS||[]).forEach(c=>{ext('),
      'grid sınırları PNG bounds büyütmemeli');
    assert.ok(!srcGp.includes('if(opts.wp)(WP||[]).forEach(w=>ext('),
      'WP sınırları PNG bounds büyütmemeli');
    assert.match(srcGp, /ctx\.restore\(\)/);
  });
});


test('LULC: yapay su rafinasyonu açıkça bağlı ve ham raster kodları korunuyor', () => {
  const src = readFileSync(new URL('../src/services/landcover.js', import.meta.url), 'utf8');
  const start = src.indexOf('async function dgLcAnalyze(params)');
  const end = src.indexOf('function downloadLandCoverClassCSV', start);
  assert.ok(start >= 0 && end > start, 'dgLcAnalyze sınırları bulunamadı');
  const body = src.slice(start, end);
  assert.match(body, /const primPromise=dgLcAnalyzeSource\(DG_LC_SOURCES\.primary/);
  assert.match(body, /dgLcFetchWaterPolygons\(bbox\)/);
  assert.match(body, /waterRefined=dgLcRefineWater\(result,waterRings\)/);
  assert.match(body, /waterRefinedCells:waterRefined/);
  assert.match(src, /rawCounts\[raw\]=/);
});
