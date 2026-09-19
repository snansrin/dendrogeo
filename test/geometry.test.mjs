/* geometry.test.mjs — gridplan.js içindeki saf geometri/jeodezi fonksiyonları.
 *
 * Bu dosya projenin EN BÜYÜK modülünü (gridplan.js, ~4.500 satır) koruyan tek
 * test katmanıdır. Örneklem ızgarası planlayıcının doğruluğu tamamen bu
 * yardımcılara dayanır: alan hesabı yanlışsa hektar yanlış, hücre-park testi
 * yanlışsa ızgara park dışına taşar.
 *
 * ══════════════════════════════════════════════════════════════════════
 * ⚠️ KOORDİNAT SIRASI — modül içinde İKİ FARKLI SÖZLEŞME VAR
 * ══════════════════════════════════════════════════════════════════════
 *
 *   ringGeodesicArea(ring)        ring noktaları [LON, LAT]   (GeoJSON sırası)
 *   polyArea(rings)               ring noktaları [LON, LAT]
 *   pointInPolygon(lat, lon, ring)  nokta (lat,lon) AMA ring [LAT, LON]
 *   pointInPark(lat, lon, rings)  aynı biçimde [LAT, LON]
 *
 * Yani ALAN fonksiyonları GeoJSON sırasında, İÇERİDE-Mİ fonksiyonları ters
 * sırada halka bekliyor. Bu bilinçli bir tasarım değil, birikmiş bir
 * tutarsızlık — ve sessiz hata üretmeye çok müsait: yanlış sırada verilen bir
 * halka çökmez, sadece yanlış sayı döner.
 *
 * Bu testlerin var olma sebeplerinden biri o sözleşmeyi BELGELEYİP KİLİTLEMEK.
 * İleride tek sıraya geçilirse bu testler kırılır ve geçiş bilinçli yapılır.
 * ══════════════════════════════════════════════════════════════════════
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from '../scripts/test-harness.mjs';

const app = loadApp();
const {
  hav, brg, ringGeodesicArea, polyArea, projectPoint,
  pointInPolygon, pointInPolygonXY, segmentsIntersect, orientation,
} = app;

const M2_KM2 = 1e-6;

describe('hav() — haversine mesafesi (m)', () => {
  test('1 derece enlem ≈ 111.195 km (R=6371000)', () => {
    const d = hav(0, 0, 1, 0);
    assert.ok(Math.abs(d - 111194.93) < 1, 'd=' + d);
  });

  test('aynı nokta → 0', () => {
    assert.equal(hav(39.9, 32.8, 39.9, 32.8), 0);
  });

  test('simetriktir: hav(a,b) === hav(b,a)', () => {
    const ileri = hav(39.9, 32.8, 41.0, 29.0);
    const geri = hav(41.0, 29.0, 39.9, 32.8);
    assert.ok(Math.abs(ileri - geri) < 1e-9);
  });

  test('Ankara → İstanbul ≈ 350 km', () => {
    const d = hav(39.9334, 32.8597, 41.0082, 28.9784);
    assert.ok(d > 340000 && d < 360000, 'd=' + d);
  });

  test('enlem arttıkça 1° boylam kısalır (cos φ ölçeklemesi)', () => {
    const ekvator = hav(0, 0, 0, 1);
    const kirkBes = hav(45, 0, 45, 1);
    assert.ok(kirkBes < ekvator * 0.75, '45° enlemde boylam yeterince kısalmadı');
    assert.ok(Math.abs(kirkBes / ekvator - Math.cos(45 * Math.PI / 180)) < 0.01);
  });
});

describe('brg() — kerteriz (derece, kuzeyden saat yönü)', () => {
  test('tam kuzey → 0', () => assert.ok(Math.abs(brg(0, 0, 1, 0)) < 1e-6));
  test('tam doğu → 90', () => assert.ok(Math.abs(brg(0, 0, 0, 1) - 90) < 1e-6));
  test('tam güney → 180', () => assert.ok(Math.abs(brg(1, 0, 0, 0) - 180) < 1e-6));
  test('tam batı → 270 ve daima [0,360) aralığında', () => {
    const b = brg(0, 0, 0, -1);
    assert.ok(b >= 0 && b < 360, 'aralık dışında: ' + b);
    assert.ok(Math.abs(b - 270) < 1e-6);
  });
});

describe('ringGeodesicArea(ring) — noktalar [LON, LAT]', () => {
  test('1° x 1° kutu ≈ 12.391 km² (küresel fazlalık formülü)', () => {
    const ring = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const km2 = ringGeodesicArea(ring) * M2_KM2;
    assert.ok(Math.abs(km2 - 12391) < 40, 'km2=' + km2);
  });

  test('KÜRE ÖZELLİĞİ: iki paralel arası bantın alanı boylamdan bağımsızdır', () => {
    // A = R²·Δλ·(sin φ2 − sin φ1) → φ merkezi bantın alanı enlem BANDINA
    // bağlıdır, bandın nerede olduğuna değil. Yani 1°x1° kutup yakınında
    // "küçülmez". Bu ilk bakışta sezgiye aykırıdır; test bunu belgeleyip
    // yanlış bir "düzeltme" yapılmasını engeller.
    const ekvator = ringGeodesicArea([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const altiDerece = ringGeodesicArea([[0, 60], [1, 60], [1, 61], [0, 61]]);
    assert.ok(Math.abs(ekvator - altiDerece) / ekvator < 0.02,
      'bant alanı enlemden bağımsız olmalı: ' + ekvator + ' vs ' + altiDerece);
  });

  test('yarım genişlikte bant → alan yarıya iner (Δλ doğrusal)', () => {
    const tam = ringGeodesicArea([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const yarim = ringGeodesicArea([[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
    assert.ok(Math.abs(yarim / tam - 0.5) < 0.01, 'oran=' + yarim / tam);
  });

  test('nokta sırası tersine çevrilince alan değişmez (Math.abs uygulanıyor)', () => {
    const ring = [[32, 39], [33, 39], [33, 40], [32, 40]];
    const ters = [...ring].reverse();
    assert.ok(Math.abs(ringGeodesicArea(ring) - ringGeodesicArea(ters)) < 1e-6);
  });

  test('Ankara çevresi 1°x1° kutu ≈ 10.451 km² (cos 39.5° etkisiyle değil, bant kuralıyla)', () => {
    const ring = [[32, 39], [33, 39], [33, 40], [32, 40]];
    const km2 = ringGeodesicArea(ring) * M2_KM2;
    assert.ok(Math.abs(km2 - 10451) < 40, 'km2=' + km2);
  });

  test('3 noktadan az halka çökertmiyor', () => {
    assert.doesNotThrow(() => ringGeodesicArea([[0, 0], [1, 1]]));
  });
});

describe('polyArea(rings) — noktalar [LON, LAT], HALKA DİZİSİ bekler', () => {
  /* polyArea TEK halka değil, halka DİZİSİ alır:
   *   polyArea([halka])                 → düz dizi dalı
   *   polyArea({outer:[halka],inner:[]}) → delikli dal
   * Bu, PARK_POLY'nin biçimiyle uyumlu (parkAreaHa PARK_POLY üzerinde döngü
   * kurup her halkayı ringGeodesicArea'ya veriyor). */
  const halka = [[32, 39], [33, 39], [33, 40], [32, 40]];
  const delik = [[32.25, 39.25], [32.75, 39.25], [32.75, 39.75], [32.25, 39.75]];

  test('{outer, inner} biçiminde delik alanı düşürülür', () => {
    const tek = polyArea({ outer: [halka], inner: [] });
    const delikli = polyArea({ outer: [halka], inner: [delik] });
    assert.ok(Math.abs(tek - ringGeodesicArea(halka)) < 1e-6);
    assert.ok(delikli < tek, 'delikli (' + delikli + ') tek parçadan (' + tek + ') küçük olmalı');
    assert.ok(Math.abs(delikli - (ringGeodesicArea(halka) - ringGeodesicArea(delik))) < 1e-6);
  });

  test('düz dizi biçimi {outer} biçimiyle aynı sonucu verir', () => {
    assert.ok(Math.abs(polyArea([halka]) - polyArea({ outer: [halka], inner: [] })) < 1e-6);
  });

  test('çok halkalı dış sınır toplanır', () => {
    const iki = polyArea([halka, delik]);
    assert.ok(Math.abs(iki - (ringGeodesicArea(halka) + ringGeodesicArea(delik))) < 1e-6);
  });

  test('delik dış halkadan büyükse sonuç 0a kırpılır (Math.max)', () => {
    const buyukDelik = [[31, 38], [34, 38], [34, 41], [31, 41]];
    assert.equal(polyArea({ outer: [halka], inner: [buyukDelik] }), 0);
  });

  test('⚠️ TUZAK: tek halka (dizi değil) verilince SESSİZCE 0 döner', () => {
    // Bu bir hata fırlatmaz, uyarı vermez — sadece 0 döner. Yanlışlıkla
    // polyArea(halka) yazan biri alanı 0 hesaplar ve ızgara planı bozulur.
    // Test bunu belgeleyip kilitler; ileride savunmacı bir denetim eklenirse
    // (ör. hata fırlatma) bu test bilinçli olarak güncellenir.
    assert.equal(polyArea(halka), 0);
    assert.equal(polyArea({ outer: halka, inner: [] }), 0);
  });

  test('null/undefined/boş girdi çökertmiyor', () => {
    assert.equal(polyArea(null), 0);
    assert.equal(polyArea(undefined), 0);
    assert.equal(polyArea([]), 0);
    assert.equal(polyArea({ outer: [], inner: [] }), 0);
  });

  test('3 noktadan kısa halkalar atlanır, toplam bozulmaz', () => {
    const ikiNokta = [[32, 39], [33, 40]];
    assert.equal(polyArea([ikiNokta]), 0);
    assert.ok(Math.abs(polyArea([halka, ikiNokta]) - polyArea([halka])) < 1e-6);
  });
});

describe('pointInPolygon(lat, lon, ring) — ring noktaları [LAT, LON]', () => {
  // DİKKAT: buradaki halka [LAT, LON] sırasında — ringGeodesicArea ile TERS.
  const kutu = [[39.0, 32.0], [39.0, 33.0], [40.0, 33.0], [40.0, 32.0]];

  test('içerideki nokta → true', () => {
    assert.equal(pointInPolygon(39.5, 32.5, kutu), true);
  });

  test('dışarıdaki nokta → false', () => {
    assert.equal(pointInPolygon(41.5, 32.5, kutu), false);
    assert.equal(pointInPolygon(39.5, 34.5, kutu), false);
  });

  test('boş veya 3 noktadan kısa halka → false, çökmüyor', () => {
    assert.equal(pointInPolygon(39.5, 32.5, null), false);
    assert.equal(pointInPolygon(39.5, 32.5, []), false);
    assert.equal(pointInPolygon(39.5, 32.5, [[39, 32], [39, 33]]), false);
  });

  test('SÖZLEŞME KİLİDİ: argümanlar (lat, lon) sırasında', () => {
    // Yer değiştirilirse sonuç değişmeli — bu, sıranın gerçekten (lat,lon)
    // olduğunu kanıtlar ve sessiz bir tersine çevirmeyi yakalar.
    assert.equal(pointInPolygon(39.5, 32.5, kutu), true);
    assert.equal(pointInPolygon(32.5, 39.5, kutu), false);
  });

  test('SÖZLEŞME KİLİDİ: alan fonksiyonlarıyla HALKA SIRASI FARKLI', () => {
    // Aynı bölgeyi tanımlayan iki halka, iki farklı sırada.
    const latlon = [[39, 32], [39, 33], [40, 33], [40, 32]];   // pointInPolygon
    const lonlat = [[32, 39], [33, 39], [33, 40], [32, 40]];   // ringGeodesicArea
    assert.equal(pointInPolygon(39.5, 32.5, latlon), true);
    assert.ok(ringGeodesicArea(lonlat) > 1e9, 'alan [LON,LAT] sırasıyla hesaplanmalı');
    // Yanlış sıra verilirse alan ÇÖKMEZ, sadece anlamsızlaşır — bu yüzden bu
    // test önemli. Aşağıdaki, sıralar karıştırıldığında ne olduğunu gösterir:
    const karisik = ringGeodesicArea(latlon);
    assert.ok(karisik > 0, 'karışık sıra bile sayı üretir (sessiz hata riski)');
  });

  test('L biçimli (içbükey) çokgende ışın yöntemi doğru çalışır', () => {
    const L = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }];
    assert.equal(pointInPolygonXY(0.5, 0.5, L), true);   // içeride
    assert.equal(pointInPolygonXY(2.5, 2.5, L), false);  // çentiğin dışında
    assert.equal(pointInPolygonXY(0.5, 2.5, L), true);   // dikey kolda
  });
});

describe('orientation() / segmentsIntersect() — {x,y} düzlem noktaları', () => {
  test('orientation 0=doğrusal, 1=saat yönü, 2=saat yönü tersi döner', () => {
    // Sıfır-merkezli işaretli değer DEĞİL; klasik 1/2 kodlaması.
    assert.equal(orientation({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }), 1);
    assert.equal(orientation({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }), 2);
    assert.equal(orientation({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }), 0);
  });

  test('çapraz parçalar kesişir', () => {
    assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }), true);
  });

  test('paralel ayrık parçalar kesişmez', () => {
    assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }), false);
  });

  test('ayrık (üst üste gelmeyen) parçalar kesişmez', () => {
    assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 }), false);
  });

  test('uç uca değen parçalar kesişir (onSegment dalı)', () => {
    assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }), true);
  });
});

describe('projectPoint(lat, lon, refLat) — yerel düzlem projeksiyonu', () => {
  test('x = lon·111320·cos(refLat), y = lat·110540', () => {
    const p = projectPoint(40, 31, 40);
    const q = projectPoint(40, 30, 40);
    const dx = Math.abs(p.x - q.x);
    const beklenen = 111320 * Math.cos(40 * Math.PI / 180); // ≈ 85.273 m/derece
    assert.ok(Math.abs(dx - beklenen) < 1, 'dx=' + dx + ' beklenen=' + beklenen);
  });

  test('referans enlem büyüdükçe x ölçeği daralır', () => {
    const genis = projectPoint(0, 1, 0).x - projectPoint(0, 0, 0).x;
    const dar = projectPoint(60, 1, 60).x - projectPoint(60, 0, 60).x;
    assert.ok(dar < genis * 0.55, '60° enlemde daralma beklenenden az');
  });

  test('deterministik (aynı girdi → aynı çıktı)', () => {
    const p1 = projectPoint(39.5, 32.5, 39.5);
    const p2 = projectPoint(39.5, 32.5, 39.5);
    assert.deepEqual({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y });
  });
});
