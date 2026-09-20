/* landcover.test.mjs — 10 m LULC motorunun bilimsel çekirdeği.
 *
 * landcover.js yayınlanan arazi örtüsü alanlarını (hektar, yüzde) doğrudan
 * üretiyor. Buradaki matematik yanlışsa rapor yanlış olur ve bunu fark etmek
 * çok zordur: çıktılar "makul görünen" sayılardır.
 *
 * Kapsam:
 *   · UTM ileri/ters projeksiyonu (Snyder) — bilinen referans değerlere karşı
 *   · EPSG bölge seçimi
 *   · shoelace alan
 *   · Sutherland-Hodgman kırpma — ALAN KORUNUMU ile
 *   · delikli poligon alanı
 *   · bbox üstüşme (null koruması dahil)
 *   · WebMercator ileri/ters + enlem kırpma
 *
 * ⚠️ KOORDİNAT SIRASI: dgLcUtmForward(lat, lon, epsg) — enlem ÖNCE.
 *    dgLcProjectGeometry de halkaları q[0]=lat, q[1]=lon diye okuyor,
 *    yani PARK_POLY'nin [lat,lon] düzeniyle uyumlu. Bu test o sözleşmeyi
 *    kilitler; gridplan.js'in alan fonksiyonları ise [LON,LAT] kullanır
 *    (bkz. geometry.test.mjs). Modüller arası bu fark kasıtlı değil ama
 *    testlerle belgelenmiş durumda.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from '../scripts/test-harness.mjs';

const app = loadApp({ sadece: ['src/config/constants.js', 'src/utils/geo.js', 'src/services/landcover.js'] });
const {
  dgLcUtmForward, dgLcUtmInverse, dgLcUtmEpsgForLatLon,
  dgLcPlanarArea, dgLcClipPolygonRect, dgLcIntersectionArea,
  dgLcBboxOverlap, dgLcProjectedArea, dgLcProjectGeometry,
  dgLonLatToWebMercator, dgWebMercatorToLonLat,
} = app;

/* ───────────────────────── UTM ───────────────────────── */

describe('dgLcUtmForward(lat, lon, epsg) — Snyder UTM ileri projeksiyonu', () => {
  test('Ankara 39.9334 N 32.8597 E → EPSG:32636 ≈ E 488012 / N 4420375', () => {
    const p = dgLcUtmForward(39.9334, 32.8597, 32636);
    assert.ok(Math.abs(p.x - 488012) < 2, 'x=' + p.x);
    assert.ok(Math.abs(p.y - 4420375) < 2, 'y=' + p.y);
  });

  test('İstanbul 41.0082 N 28.9784 E → EPSG:32635 ≈ E 666371 / N 4541552', () => {
    const p = dgLcUtmForward(41.0082, 28.9784, 32635);
    assert.ok(Math.abs(p.x - 666371) < 2, 'x=' + p.x);
    assert.ok(Math.abs(p.y - 4541552) < 2, 'y=' + p.y);
  });

  test('bölge merkez boylamında + ekvatorda → tam false easting (500000, 0)', () => {
    // EPSG:32636 → bölge 36 → merkez boylam 33°E
    const p = dgLcUtmForward(0, 33, 32636);
    assert.ok(Math.abs(p.x - 500000) < 1e-6, 'x=' + p.x);
    assert.ok(Math.abs(p.y) < 1e-6, 'y=' + p.y);
  });

  test('güney yarımküre → +10 000 000 false northing', () => {
    const kuzey = dgLcUtmForward(1, 33, 32636);
    const guney = dgLcUtmForward(-1, 33, 32736);
    assert.ok(guney.y > 9_000_000, 'güney y=' + guney.y);
    assert.ok(kuzey.y < 200_000, 'kuzey y=' + kuzey.y);
  });

  test('k0=0.9996 ölçeği uygulanıyor (merkezden uzaklaştıkça x artar)', () => {
    const merkez = dgLcUtmForward(0, 33, 32636).x;      // 500000
    const dogu = dgLcUtmForward(0, 33.5, 32636).x;
    assert.ok(dogu > merkez);
    // 0.5° ≈ 55.66 km ekvatorda, k0 ile ~55.63 km
    assert.ok(Math.abs(dogu - merkez - 55630) < 200, 'fark=' + (dogu - merkez));
  });
});

describe('dgLcUtmInverse — ileri projeksiyonun tersi', () => {
  const noktalar = [
    ['Ankara', 39.9334, 32.8597, 32636],
    ['İstanbul', 41.0082, 28.9784, 32635],
    ['Antalya', 36.8969, 30.7133, 32636],
    ['Ekvator-merkez', 0, 33, 32636],
    ['Yüksek enlem', 68.5, 27.0, 32635],
  ];

  for (const [ad, lat, lon, epsg] of noktalar) {
    test(`${ad}: ileri → ters ≈ özgün değer (< 1e-5°)`, () => {
      const p = dgLcUtmForward(lat, lon, epsg);
      const g = dgLcUtmInverse(p.x, p.y, epsg);
      assert.ok(Math.abs(g.lat - lat) < 1e-5, `lat ${g.lat} != ${lat}`);
      assert.ok(Math.abs(g.lon - lon) < 1e-5, `lon ${g.lon} != ${lon}`);
    });
  }
});

describe('dgLcUtmEpsgForLatLon — bölge ve yarımküre seçimi', () => {
  test('Ankara (32.86 E) → 32636', () => assert.equal(dgLcUtmEpsgForLatLon(39.93, 32.86), 32636));
  test('İstanbul (28.98 E) → 32635', () => assert.equal(dgLcUtmEpsgForLatLon(41.01, 28.98), 32635));
  test('güney yarımküre → 327xx', () => assert.equal(dgLcUtmEpsgForLatLon(-33.87, 151.21), 32756));
  test('ekvator kuzey sayılır (>= 0)', () => assert.equal(dgLcUtmEpsgForLatLon(0, 33), 32636));
  test('tarih değiştirme çizgisi yakınında bölge 1-60 arasına kırpılır', () => {
    assert.equal(dgLcUtmEpsgForLatLon(0, 180), 32660);
    assert.equal(dgLcUtmEpsgForLatLon(0, -180), 32601);
  });
});

/* ───────────────────────── alan ve kırpma ───────────────────────── */

describe('dgLcPlanarArea — shoelace', () => {
  test('10x10 kare → 100', () => {
    assert.equal(dgLcPlanarArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]), 100);
  });

  test('nokta sırası tersine çevrilince alan değişmez (Math.abs)', () => {
    const halka = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    assert.equal(dgLcPlanarArea(halka), dgLcPlanarArea([...halka].reverse()));
  });

  test('3 noktadan az → 0, çökmüyor', () => {
    assert.equal(dgLcPlanarArea([]), 0);
    assert.equal(dgLcPlanarArea(null), 0);
    assert.equal(dgLcPlanarArea([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
  });

  test('üçgen alanı doğru (dik üçgen)', () => {
    assert.equal(dgLcPlanarArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }]), 6);
  });
});

describe('dgLcClipPolygonRect — Sutherland-Hodgman', () => {
  const pencere = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

  /* Test yardımcısı — ışınlı nokta-içi testi. Uygulamanın pointInPolygon'u
   * coğrafi projeksiyon yaptığı için burada düz {x,y} halkalar üzerinde
   * çalışan bağımsız bir gerçeklem kullanılıyor (testin uygulama koduna
   * bağımlı olmaması için). */
  const noktaIceride = (px, py, halka) => {
    let ic = false;
    for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
      const xi = halka[i].x, yi = halka[i].y, xj = halka[j].x, yj = halka[j].y;
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ic = !ic;
    }
    return ic;
  };

  test('tamamen içerideki poligon değişmez', () => {
    const kare = [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 }];
    assert.equal(dgLcPlanarArea(dgLcClipPolygonRect(kare, pencere)), 9);
  });

  test('tamamen dışarıdaki poligon → boş, alan 0', () => {
    const uzak = [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }];
    assert.equal(dgLcClipPolygonRect(uzak, pencere).length, 0);
    assert.equal(dgLcPlanarArea(dgLcClipPolygonRect(uzak, pencere)), 0);
  });

  test('⭐ ALAN KORUNUMU: pencereyi taşan kare tam pencere alanına kırpılır', () => {
    const buyuk = [{ x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: 20 }, { x: -20, y: 20 }];
    const kirpik = dgLcClipPolygonRect(buyuk, pencere);
    const alan = dgLcPlanarArea(kirpik);
    assert.ok(Math.abs(alan - 100) < 1e-9, 'alan=' + alan + ' (beklenen 100)');
  });

  test('⭐ ALAN KORUNUMU: yarı yarıya örtüşme → tam yarısı', () => {
    const yarim = [{ x: 5, y: -10 }, { x: 25, y: -10 }, { x: 25, y: 25 }, { x: 5, y: 25 }];
    const alan = dgLcPlanarArea(dgLcClipPolygonRect(yarim, pencere));
    assert.ok(Math.abs(alan - 50) < 1e-9, 'alan=' + alan + ' (beklenen 50)');
  });

  test('elmas: köşegenler pencereyi çapraz keser → tam yarısı', () => {
    const elmas = [{ x: -10, y: 0 }, { x: 0, y: -10 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    const alan = dgLcPlanarArea(dgLcClipPolygonRect(elmas, pencere));
    assert.ok(Math.abs(alan - 50) < 1e-9, 'alan=' + alan);
  });

  test('üçgen: hipotenüs pencerenin içinden geçer → 12.5', () => {
    const ucgen = [{ x: 0, y: 5 }, { x: 5, y: 0 }, { x: 5, y: 5 }];
    const alan = dgLcPlanarArea(dgLcClipPolygonRect(ucgen, pencere));
    assert.ok(Math.abs(alan - 12.5) < 1e-9, 'alan=' + alan);
  });

  test('çeyrek örtüşen kare → 25', () => {
    const kare = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }];
    const alan = dgLcPlanarArea(dgLcClipPolygonRect(kare, pencere));
    assert.ok(Math.abs(alan - 25) < 1e-9, 'alan=' + alan);
  });

  /* Bu iki vaka YANLIŞ BEKLENTİ tuzağını belgelemek için burada:
   * ikisinde de kırpma fonksiyonu 0 döndürüyor ve 0 DOĞRU. */
  test('köşeye tam değen kare → 0 (değme, örtüşme değildir)', () => {
    const kare = [{ x: -10, y: -10 }, { x: 0, y: -10 }, { x: 0, y: 0 }, { x: -10, y: 0 }];
    assert.equal(dgLcPlanarArea(dgLcClipPolygonRect(kare, pencere)), 0);
  });

  test('hipotenüsü yalnızca (10,10) köşesinde değen üçgen → 0', () => {
    // x+y=20 doğrusu, [0,10]x[0,10] penceresine yalnızca (10,10) noktasında
    // değer (pencere içinde x+y en fazla 20 olabilir). Kesişim bir NOKTADIR,
    // alanı yoktur. İlk bakışta "üçgen pencereyi kesiyor" gibi görünür.
    const ucgen = [{ x: 0, y: 20 }, { x: 20, y: 0 }, { x: 20, y: 20 }];
    assert.equal(dgLcPlanarArea(dgLcClipPolygonRect(ucgen, pencere)), 0);
  });

  test('pencereyi tamamen kaplayan poligon → tam pencere alanı', () => {
    const buyuk = [{ x: -1, y: -1 }, { x: 11, y: -1 }, { x: 11, y: 11 }, { x: -1, y: 11 }];
    assert.ok(Math.abs(dgLcPlanarArea(dgLcClipPolygonRect(buyuk, pencere)) - 100) < 1e-9);
  });

  test('içbükey (L biçimli) poligon doğru kırpılır', () => {
    const L = [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 15 }, { x: -5, y: 15 }];
    // Pencere [0,10]x[0,10] içinde kalan: 10x5 (alt şerit) + 5x5 (sol üst) = 50+... 
    // tam olarak: x∈[0,10],y∈[0,5] → 50 ; x∈[0,5],y∈[5,10] → 25 ; toplam 75
    const alan = dgLcPlanarArea(dgLcClipPolygonRect(L, pencere));
    assert.ok(Math.abs(alan - 75) < 1e-9, 'alan=' + alan + ' (beklenen 75)');
  });

  test('geçersiz girdi → boş dizi, çökmüyor', () => {
    assert.deepEqual(dgLcClipPolygonRect(null, pencere).length, 0);
    assert.deepEqual(dgLcClipPolygonRect([{ x: 0, y: 0 }], pencere).length, 0);
  });

  /* ⭐ ÖZELLİK TESTİ: alan korunumu.
   *
   * Sabit vakalar elle hesaplandığı için yanlış beklenti yazmak kolay (bu
   * dosyanın ilk sürümünde üç kez yapıldı). O yüzden asıl güvence burada:
   * rassal basit poligonlar üretiliyor ve kırpılmış alanın
   *   0 ≤ A_kırpık ≤ min(A_poligon, A_pencere)
   * sınırını sağladığı, ayrıca poligon pencereyi tam kapsıyorsa alanın tam
   * pencere alanına eşit olduğu denetleniyor. Tohum sabit, yani test
   * tekrarlanabilir. */
  test('⭐ rassal poligonlarda alan korunumu (500 vaka, sabit tohum)', () => {
    let tohum = 20260920;
    const rnd = () => {                       // LCG — deterministik, tekrarlanabilir
      tohum = (tohum * 1103515245 + 12345) % 2147483648;
      return tohum / 2147483648;
    };
    const W2 = { minX: -5, maxX: 15, minY: -8, maxY: 12 };
    const pencereAlani = (W2.maxX - W2.minX) * (W2.maxY - W2.minY);

    for (let i = 0; i < 500; i++) {
      // Merkez + yarıçap + açı ile basit (kendini kesmeyen) poligon üret
      const cx = -20 + rnd() * 40, cy = -20 + rnd() * 40;
      const n = 3 + Math.floor(rnd() * 5);
      const halka = [];
      for (let k = 0; k < n; k++) {
        const aci = (2 * Math.PI * k) / n;
        const r = 2 + rnd() * 10;
        halka.push({ x: cx + r * Math.cos(aci), y: cy + r * Math.sin(aci) });
      }
      const tumAlan = dgLcPlanarArea(halka);
      const kirpik = dgLcPlanarArea(dgLcClipPolygonRect(halka, W2));

      assert.ok(Number.isFinite(kirpik), 'alan sonlu değil (NaN yayılması) — vaka ' + i);
      assert.ok(kirpik >= 0, 'negatif alan: ' + kirpik);
      assert.ok(kirpik <= pencereAlani + 1e-6,
        `kırpık alan (${kirpik}) pencere alanını (${pencereAlani}) aştı — vaka ${i}`);
      assert.ok(kirpik <= tumAlan + 1e-6,
        `kırpık alan (${kirpik}) poligon alanını (${tumAlan}) aştı — vaka ${i}`);

      /* DEĞİŞMEZ 3: pencerenin dört köşesi de poligonun İÇİNDEYSE kırpma
       * alanı tam pencere alanına eşit olmalı. Bu, "fazladan alan üretme"
       * sınıfındaki hataları yakalayan en güçlü denetim: hatalı bir kırpma
       * kapsayan poligonu küçültür.
       *
       * NOT: Ters yön GEÇERLİ DEĞİLDİR — tüm köşeleri pencerenin dışında olan
       * bir poligon pencereyi yine de tamamen kapsayabilir (büyük bir üçgen
       * gibi) ya da kenarları pencereyi kesebilir. Bu yüzden "dışarıdaki
       * poligon alan üretmemeli" denetimi YAPILMAZ; matematiksel olarak yanlış
       * olurdu ve bu dosyanın ilk sürümünde yanlış bir kırmızı alarma yol açtı. */
      const koseIceride = [[W2.minX, W2.minY], [W2.maxX, W2.minY], [W2.maxX, W2.maxY], [W2.minX, W2.maxY]]
        .every(([px, py]) => noktaIceride(px, py, halka));
      if (koseIceride) {
        assert.ok(Math.abs(kirpik - pencereAlani) < 1e-6,
          `pencereyi kapsayan poligon tam alan vermeli: ${kirpik} ≠ ${pencereAlani} (vaka ${i})`);
      }
    }
  });

  test('hücre ızgarası benzetimi: bitişik hücrelerin alan toplamı parkı verir', () => {
    /* LULC motorunun yaptığı işin özü bu: park poligonunu 10 m hücrelere
     * bölüp her kesişimin alanını toplamak. Toplam, parkın kendi alanına
     * eşit olmalı — commit mesajlarındaki "area-conserving" iddiası bu. */
    const park = [{ x: 3, y: 7 }, { x: 47, y: 2 }, { x: 61, y: 38 }, { x: 22, y: 51 }];
    const parkAlani = dgLcPlanarArea(park);
    let toplam = 0;
    const H = 10;
    for (let r = 0; r < 60; r += H) {
      for (let c = 0; c < 70; c += H) {
        const rect = { minX: c, maxX: c + H, minY: r, maxY: r + H };
        toplam += dgLcPlanarArea(dgLcClipPolygonRect(park, rect));
      }
    }
    assert.ok(Math.abs(toplam - parkAlani) / parkAlani < 1e-9,
      `hücre toplamı ${toplam} ≠ park alanı ${parkAlani}`);
  });
});

describe('dgLcIntersectionArea — delikli poligon ∩ raster hücresi', () => {
  const halka = (pts) => { const p = pts.map(([y, x]) => ({ x, y })); p._bbox = bbox(p); return p; };
  const bbox = (p) => p.reduce((a, q) => ({
    minX: Math.min(a.minX, q.x), minY: Math.min(a.minY, q.y),
    maxX: Math.max(a.maxX, q.x), maxY: Math.max(a.maxY, q.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const tamKare = halka([[0, 0], [0, 100], [100, 100], [100, 0]]);   // 100x100 = 10000
  const hucre = { minX: 0, maxX: 10, minY: 0, maxY: 10 };             // 10x10 = 100

  test('hücre poligonun içindeyse tam hücre alanı döner', () => {
    assert.equal(dgLcIntersectionArea([tamKare], [], hucre), 100);
  });

  test('delik hücreyi kapsıyorsa alan 0', () => {
    const delik = halka([[-10, -10], [-10, 20], [20, 20], [20, -10]]);
    assert.equal(dgLcIntersectionArea([tamKare], [delik], hucre), 0);
  });

  test('delik hücrenin yarısını kaplıyorsa alan yarıya iner', () => {
    const delik = halka([[0, 0], [0, 5], [100, 5], [100, 0]]);
    const a = dgLcIntersectionArea([tamKare], [delik], hucre);
    assert.ok(Math.abs(a - 50) < 1e-9, 'alan=' + a);
  });

  test('üstüşmeyen hücre → 0 (bbox kısayolu)', () => {
    const uzakHucre = { minX: 5000, maxX: 5010, minY: 5000, maxY: 5010 };
    assert.equal(dgLcIntersectionArea([tamKare], [], uzakHucre), 0);
  });

  test('sonuç asla negatif olmaz (Math.max)', () => {
    const sadeceDelik = halka([[-5, -5], [-5, 50], [50, 50], [50, -5]]);
    assert.equal(dgLcIntersectionArea([], [sadeceDelik], hucre), 0);
  });

  test('boş/null girdi → 0, çökmüyor', () => {
    assert.equal(dgLcIntersectionArea(null, null, hucre), 0);
    assert.equal(dgLcIntersectionArea([], [], hucre), 0);
  });
});

describe('dgLcBboxOverlap — null koruması', () => {
  const A = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  test('üstüşen → true', () => assert.equal(dgLcBboxOverlap(A, { minX: 5, minY: 5, maxX: 15, maxY: 15 }), true));
  test('ayrık → false', () => assert.equal(dgLcBboxOverlap(A, { minX: 20, minY: 20, maxX: 30, maxY: 30 }), false));
  test('yalnızca kenardan değen → false (<= / >= karşılaştırması)', () => {
    assert.equal(dgLcBboxOverlap(A, { minX: 10, minY: 0, maxX: 20, maxY: 10 }), false);
  });
  test('⭐ undefined ile ÇÖKMÜYOR (regresyon kilidi)', () => {
    assert.doesNotThrow(() => dgLcBboxOverlap(undefined, A));
    assert.doesNotThrow(() => dgLcBboxOverlap(A, null));
    assert.equal(dgLcBboxOverlap(undefined, A), false);
  });
});

describe('dgLcProjectedArea / dgLcProjectGeometry', () => {
  test('dış halka eksi delikler, negatif değil', () => {
    const dis = [[0, 0], [0, 0.01], [0.01, 0.01], [0.01, 0]];
    const delik = [[0.004, 0.004], [0.004, 0.006], [0.006, 0.006], [0.006, 0.004]];
    const g = dgLcProjectGeometry([dis], [delik], 32636);
    const alan = dgLcProjectedArea(g);
    assert.ok(alan > 0, 'alan=' + alan);
    const deliksiz = dgLcProjectedArea(dgLcProjectGeometry([dis], [], 32636));
    assert.ok(alan < deliksiz, 'delik alanı düşürmeli');
  });

  test('⭐ SÖZLEŞME: dgLcProjectGeometry halkayı [LAT, LON] okuyor', () => {
    // Ankara çevresi küçük bir kutu. [lat,lon] doğru sıraysa UTM bölgesi 36
    // içinde makul koordinatlar üretir; ters sırada enlem 32 olur ve alan
    // belirgin biçimde farklılaşır.
    const latlon = [[39.90, 32.80], [39.90, 32.90], [39.95, 32.90], [39.95, 32.80]];
    const g = dgLcProjectGeometry([latlon], [], 32636);
    const p = g.outer[0][0];
    // 39.90 N → northing ~4.42e6 ; 32.80 E bölge 36'da → easting ~4.8e5
    assert.ok(p.y > 4_000_000 && p.y < 5_000_000, 'y=' + p.y + ' (enlem gibi görünmeli)');
    assert.ok(p.x > 300_000 && p.x < 700_000, 'x=' + p.x + ' (boylam gibi görünmeli)');
  });

  test('her halkaya _bbox atanıyor (dgLcIntersectionArea buna güveniyor)', () => {
    const g = dgLcProjectGeometry([[[39.9, 32.8], [39.9, 32.9], [39.95, 32.9]]], [], 32636);
    assert.ok(g.outer[0]._bbox, '_bbox atanmamış');
    assert.ok(Number.isFinite(g.outer[0]._bbox.minX));
  });

  test('2 noktadan kısa halkalar eleniyor (filter r.length>=3)', () => {
    const g = dgLcProjectGeometry([[[39.9, 32.8], [39.9, 32.9]]], [], 32636);
    assert.equal(g.outer.length, 0);
  });
});

/* ───────────────────────── WebMercator (geo.js) ───────────────────────── */

describe('dgLonLatToWebMercator / dgWebMercatorToLonLat', () => {
  test('EPSG:3857 bilinen değer: 30 E 45 N → (3339584.7, 5621521.5)', () => {
    const p = dgLonLatToWebMercator(45, 30);
    assert.ok(Math.abs(p.x - 3339584.728) < 1, 'x=' + p.x);
    assert.ok(Math.abs(p.y - 5621521.486) < 1, 'y=' + p.y);
  });

  test('başlangıç noktası → (0, 0)', () => {
    const p = dgLonLatToWebMercator(0, 0);
    assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9);
  });

  test('yarı çevre: 90 E → x = πR/2 = 10018754.17', () => {
    const p = dgLonLatToWebMercator(0, 90);
    assert.ok(Math.abs(p.x - 10018754.171) < 1, 'x=' + p.x);
  });

  test('enlem ±85.0511287798 üzerine kırpılıyor (Web Mercator sınırı)', () => {
    const a = dgLonLatToWebMercator(89, 0);
    const b = dgLonLatToWebMercator(85.0511287798, 0);
    assert.ok(Math.abs(a.y - b.y) < 1e-6, 'kırpma çalışmıyor: ' + a.y + ' vs ' + b.y);
    assert.ok(a.y < 20037509, 'y=' + a.y);
  });

  test('ileri → ters dönüş (< 1e-7°)', () => {
    for (const [lat, lon] of [[39.9334, 32.8597], [41.0082, 28.9784], [-33.87, 151.21], [0, 0], [70, -25]]) {
      const p = dgLonLatToWebMercator(lat, lon);
      const g = dgWebMercatorToLonLat(p.x, p.y);
      assert.ok(Math.abs(g.lat - Math.max(-85.0511287798, Math.min(85.0511287798, lat))) < 1e-7, `lat ${g.lat}`);
      assert.ok(Math.abs(g.lon - lon) < 1e-7, `lon ${g.lon}`);
    }
  });

  test('geçersiz girdi: ileri throw eder, ters null döner', () => {
    assert.throws(() => dgLonLatToWebMercator(NaN, 30), /Geçersiz WGS84/);
    assert.throws(() => dgLonLatToWebMercator(45, Infinity), /Geçersiz WGS84/);
    assert.equal(dgWebMercatorToLonLat(NaN, 0), null);
    assert.equal(dgWebMercatorToLonLat(0, undefined), null);
  });

  test('R = 6378137 (WGS84 yarıçapı) kullanılıyor', () => {
    const p = dgLonLatToWebMercator(0, 180);
    assert.ok(Math.abs(p.x - 20037508.34) < 1, 'x=' + p.x);
  });
});

/* ───────────────────────── sabitler ───────────────────────── */

describe('LULC sabitleri ve sınıf eşlemesi', () => {
  test('koleksiyon, yıl ve piksel ölçeği beklenen değerlerde', () => {
    assert.equal(app.DG_LC_COLLECTION, 'io-lulc-annual-v02');
    assert.equal(app.DG_LC_YEAR, 2020);
    assert.equal(app.DG_LC_PIXEL_M, 10);
  });

  test('kaynak sınırları tanımlı ve makul', () => {
    assert.ok(app.DG_LC_MAX_TILES > 0 && app.DG_LC_MAX_TILES <= 64, 'MAX_TILES=' + app.DG_LC_MAX_TILES);
    assert.ok(app.DG_LC_MAX_READ_PIXELS > 0, 'MAX_READ_PIXELS=' + app.DG_LC_MAX_READ_PIXELS);
    assert.ok(app.DG_LC_RENDER_LIMIT > 0, 'RENDER_LIMIT=' + app.DG_LC_RENDER_LIMIT);
  });

  test('io-lulc sınıf kodları doğru eşlenmiş', () => {
    assert.equal(app.DG_LC_CODES[1], 'Su');
    assert.equal(app.DG_LC_CODES[2], 'Ağaç');
    assert.equal(app.DG_LC_CODES[7], 'Yapılı alan');
    assert.equal(app.DG_LC_CODES[10], 'Bulut');
  });

  test('⚠️ CANARY: hücre geometrisi GERÇEK köşelerden kuruluyor (sabit piksel varsayımı yok)', () => {
    // a4e6265 hücre poligonunu sabit DG_LC_PIXEL_M/2'den gerçek meta.dx/dy'ye
    // taşımıştı; v4 motoruyla hücreler artık doğrudan dört gerçek köşe
    // (quadWgs) taşıyor — EPSG:4326 karolarda anizotropik hücre şekli korunur.
    // Biri sabit piksel varsayımına geri dönerse bu test kırılır.
    const src = readFileSync(new URL('../src/services/landcover.js', import.meta.url), 'utf8');
    assert.match(src, /quadWgs/, 'hücreler gerçek köşe listesini taşımalı');
    assert.match(src, /dgLcIntersectionAreaConvex\(geometry\.outer,geometry\.holes,quad\)/,
      'alanlar tam dışbükey kesişimle hesaplanmalı');
    assert.doesNotMatch(src, /const half=DG_LC_PIXEL_M\/2/,
      'sabit piksel yarı-boyu geri gelmemeli');
  });
});
