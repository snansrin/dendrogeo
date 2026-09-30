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
 *  6) import-measurements.mjs: DBH = göğüs çapı (cm); çevre→çap (÷π) dönüşümü YOK
 *  7) renderReport: accuracy_m NULL iken "±0,0 m" UYDURMAZ; QA satırları basılır
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadRho, loadSpeciesDict, calcRow, carbonKg, QA_LIMITS, MC_CFG, canonicalHash, QA_STATE, qaStateOf, DBH_REASON_TR } from '../scripts/lib/mc.mjs';
import { inventoryQa, bboxRing, ringGeodesicAreaM2, renderReport } from '../scripts/make-report.mjs';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const app = loadApp(['src/config/species.js', 'src/services/allometry.js']);

describe('0011 · loadRho — tür ρ tablosu gerçekten okunuyor', () => {
  test('regex hatası gerilemesi: harita BOŞ değil (eski sürüm 0 tür okuyordu)', () => {
    const { rho } = loadRho();
    assert.ok(Object.keys(rho).length >= 20, 'rho anahtarı: ' + Object.keys(rho).length);
  });
  test('sözlük değerleri panel ile aynı (0011e: 5 tür kaynaklı ρ ile listede)', () => {
    const { rho, grho } = loadRho();
    assert.equal(rho['KARAÇAM'], 470);
    assert.equal(rho['SIĞLA'], 468);
    assert.equal(rho['KIZILÇAM'], 478);
    // 0011e (kullanıcı kararı): Göksu'nun 5 türü panel listesinde ve
    // ρ'ları 0011'in çalıştırılmış SQL'iyle birebir (Zanne 2009 / Wood DB).
    assert.equal(rho['SALKIM SÖĞÜT'], 400);
    assert.equal(rho['MAVİ LADİN'], 450);
    assert.equal(rho['DOĞU ÇINARI'], 600);
    assert.equal(rho['ATLAS SEDİRİ'], 490);
    assert.equal(rho['CEVİZ'], 560);
    // AĞLAYAN SÖĞÜT panelde yok (kullanıcı isteği) — çözümleyicide var
    assert.equal(rho['AĞLAYAN SÖĞÜT'], undefined);
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
    assert.equal(d.byName['AĞLAYAN SÖĞÜT'].panel, false, 'gizli kayıt panel bayrağı');
  });
});

describe('0031+0032 · inventoryQa — envanter kalite kapısı (QA v4: DBH = göğüs çapı cm, çift ρ kaynağı, anıtsal gövde)', () => {
  const dict = loadSpeciesDict();
  const mk = (point_id, species, grp, dbh_cm, height_m, carbon_kg, extra = {}) =>
    ({ id: point_id, point_id, species, grp, dbh_cm, height_m, carbon_kg, ...extra });

  test('ham Göksu verisi (anıtsal gövde) BLOKLANMAZ ve ŞÜPHELİ de sayılmaz — QA v4 (0032)', () => {
    /* Gerçek 28.09.2026 envanterinden temsilci dilim.
     * 0011 kapısı bu veriyi "kolon çevre olabilir" varsayımıyla ⛔ BLOKLU
     * ilan ediyordu (yanlış). 0031 bunu 🟡 İNCELEMEye indirdi ama iki kalem
     * hâlâ veri hatası iması taşıyordu: 6/6 kayıt "olağandışı boy/çap oranı",
     * 3/6 kayıt "bant dışı karbon". 0032de ikisi de düzeltildi:
     *   (a) DBH geçerlilik 6/6 GEÇER → blok yok
     *   (b) gövde formu: sabit bant yerine fiziksel makullük (3–200) + stand
     *       içi robust aykırılık (modified z > 3,5). Tipik 15–120 bandı dışı
     *       kayıtlar yalnız SAYILIR (hd_band_out) → uyarı üretmez
     *   (c) karbon: beklenen değer İKİ ρ kaynağıyla hesaplanır (tür ρ / grup
     *       varsayılanı ρ); saklı değer herhangi biriyle ±%20 içindeyse geçer.
     *       Böylece P3/P32 (grup ρ=541 ile birebir) aklanır, P7nin 10x
     *       ondalık kayması YAKALANMAYA DEVAM EDER.
     *   (d) anıtsal gövde beyanı: DBH ≥ 100 cm olan 4 birey ℹ️ Beyan üretir,
     *       QA durumunu ETKİLEMEZ. */
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
    assert.equal(qa.n_unknown, 0, 'türler sözlükte');
    /* (a) DBH birim/geçerlilik: hepsi sayısal, pozitif, cm aralığında */
    assert.equal(qa.dbh_fail.length, 0, 'DBH geçerlilik ihlali olmamalı: ' + JSON.stringify(qa.dbh_fail));
    assert.equal(qa.dbh_block, false);
    /* (b) gövde formu: tipik bant 6/6 kayıtta aşılır ama bu yalnız SAYIMDIR */
    assert.equal(qa.hd_band_out.length, 6, 'tipik 15–120 bandı dışı sayım: ' + JSON.stringify(qa.hd_band_out));
    assert.equal(qa.hd_fail.length, 0, 'fiziksel bant + robust z → aykırı kayıt yok: ' + JSON.stringify(qa.hd_fail));
    assert.equal(qa.hd_block, false, 'boy/çap oranı ASLA bloklamaz (0031)');
    assert.equal(qa.hd_review, false, '0032: anıtsal gövdeli stand artık inceleme üretmiyor');
    assert.ok(qa.hd_stats && qa.hd_stats.n === 6, 'stand dağılımı hesaplandı: ' + JSON.stringify(qa.hd_stats));
    assert.ok(Math.abs(qa.hd_stats.z_max) <= QA_LIMITS.HD_ROBUST_Z, 'en yüksek |z| eşiğin altında: ' + qa.hd_stats.z_max);
    /* (c) karbon: yalnız GERÇEK hesap hatası bayraklanır (P7 10x ondalık kayması) */
    assert.equal(qa.dev_fail.length, 1, 'tek gerçek hata: ' + JSON.stringify(qa.dev_fail));
    assert.equal(qa.dev_fail[0].point_id, 7);
    assert.ok(Math.abs(qa.dev_fail[0].dev_pct) > 50, 'P7 sapma %50 üstü: ' + qa.dev_fail[0].dev_pct);
    assert.equal(qa.dev_block, false, '1/6 → sistemik değil');
    assert.deepEqual(qa.dev_rho.grup_farkli.map((x) => x.point_id), [3, 32],
      'grup varsayılanı ρ ile birebir olan ama tür ρ ile bant aşan kayıtlar');
    assert.equal(qa.dev_rho.n, 5, '5/6 kayıt yeniden üretildi');
    assert.equal(qa.dev_rho.tur + qa.dev_rho.grup, 5);
    /* (d) anıtsal gövde beyanı (ℹ️ — duruma etkisi YOK) */
    assert.equal(qa.anit.n, 4, 'DBH ≥ 100 cm: P1 110, P3 166, P7 107, P32 200');
    assert.deepEqual(qa.anit.points.map((x) => x.point_id), [1, 3, 7, 32]);
    assert.equal(qa.anit.max_dbh_cm, 200);
    assert.equal(qa.anit.threshold_cm, 100);
    assert.deepEqual(qa.info.map((x) => x.key), ['anit', 'rho-kaynagi']);
    /* Üç hâlli durum: tek gerçek hata (P7) inceleme üretir; BLOKLU değil */
    assert.equal(qa.state, 'INCELEME', 'durum: ' + qa.state);
    /* π ile türetilmiş bir değer YOK: DBH sahada kaydedildiği gibi */
    assert.equal(qa.rows.find((r) => r.point_id === 7).dbh_cm, 107);
  });

  test('boy/çap gösterge aralığında olduğunda durum 🟢 GEÇERLİ', () => {
    const rows = [
      mk(1, 'SÜS ERİĞİ', 'YAPRAKLI', 35, 10.2, null),
      mk(3, 'SALKIM SÖĞÜT', 'YAPRAKLI', 53, 14, null),
      mk(7, 'KARAÇAM', 'İBRELİ', 34, 12, null),
      mk(29, 'IHLAMUR', 'YAPRAKLI', 13, 4.5, null),
    ];
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.hd_fail.length, 0, 'oran ihlali yok: ' + JSON.stringify(qa.hd_fail));
    assert.equal(qa.hd_block, false);
    assert.equal(qa.dbh_fail.length, 0);
    for (const r of qa.rows) assert.ok(r.hd >= QA_LIMITS.HD_MIN && r.hd <= QA_LIMITS.HD_MAX, `P${r.point_id} h/D=${r.hd}`);
    assert.equal(qa.state, 'GECERLI');
  });

  test('DBH geçerlilik zinciri: eksik / sayısal değil / ≤0 / cm aralığı dışı', () => {
    const rows = [
      mk(1, 'MEŞE', 'YAPRAKLI', null, 12, null),
      mk(2, 'MEŞE', 'YAPRAKLI', 'yok', 12, null),
      mk(3, 'MEŞE', 'YAPRAKLI', 0, 12, null),
      mk(4, 'MEŞE', 'YAPRAKLI', QA_LIMITS.DBH_MAX_CM + 1, 12, null),
    ];
    const qa = inventoryQa(rows, dict);
    assert.deepEqual(qa.dbh_fail.map((x) => [x.point_id, x.reason]),
      [[1, 'eksik'], [2, 'sayisal-degil'], [3, 'pozitif-degil'], [4, 'aralik-disi']]);
    assert.equal(qa.dbh_block, true, '4/4 sistemik → kritik veri hatası bloklar');
    assert.equal(qa.state, 'BLOKLU');
    /* Gerekçe metinleri "çevre olabilir" iddiası İÇERMEZ */
    for (const r of Object.values(DBH_REASON_TR)) assert.ok(!/çevre/.test(r), r);
  });

  test('tekil bodur ağaç: fiziksel olarak makul → inceleme ÜRETMEZ (0032)', () => {
    /* 0031de bu fikstür "1 kayıt olağandışı oranda" diye ⚠ üretiyordu: 12 cm
     * gövde / 1,5 m boy → h/D = 12,5, tipik 15–120 bandının altında. Oysa bu
     * genç/fide formu için fiziksel olarak olağandır; sabit bant tek başına
     * hata hükmü veremez. 0032: tipik bant dışı kayıt SAYILIR, uyarı yalnız
     * fiziksel olanaksızlıkta veya stand içi aykırılıkta üretilir. */
    const rows = [
      mk(1, 'MEŞE', 'YAPRAKLI', 40, 15, null),   // h/D = 37,5 → tipik bantta
      mk(2, 'MEŞE', 'YAPRAKLI', 50, 18, null),   // h/D = 36   → tipik bantta
      mk(3, 'SÜS ERİĞİ', 'YAPRAKLI', 12, 1.5, null), // h/D = 12,5 → bant dışı SAYIM
      mk(4, 'KARAÇAM', 'İBRELİ', 45, 20, null),  // h/D = 44,4 → tipik bantta
    ];
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.hd_band_out.length, 1, 'tipik bant dışı sayım (bilgi): ' + JSON.stringify(qa.hd_band_out));
    assert.equal(qa.hd_fail.length, 0, 'fiziksel olarak makul → aykırı değil');
    assert.equal(qa.hd_stats, null, 'n < HD_ROBUST_MIN_N → robust z testi KOŞULMAZ (küçük örneklemde sahte aykırı yok)');
    assert.equal(qa.hd_block, false, 'boy/çap oranı hiçbir ölçekte bloklamaz (0031)');
    assert.equal(qa.hd_review, false);
    assert.equal(qa.state, 'GECERLI', 'durum: ' + qa.state);
  });

  test('fiziksel olarak olanaksız oran ⚠ İNCELEME üretir, ⛔ blok üretmez', () => {
    const rows = [
      mk(1, 'MEŞE', 'YAPRAKLI', 40, 15, null),
      mk(2, 'MEŞE', 'YAPRAKLI', 50, 18, null),
      mk(3, 'MEŞE', 'YAPRAKLI', 120, 1.5, null), // h/D = 1,25 < HD_PHYS_MIN (3)
      mk(4, 'KARAÇAM', 'İBRELİ', 45, 20, null),
    ];
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.hd_fail.length, 1);
    assert.equal(qa.hd_fail[0].point_id, 3);
    assert.equal(qa.hd_fail[0].reason, 'fiziksel-alt');
    assert.equal(qa.hd_block, false, 'boy/çap oranı ASLA bloklamaz');
    assert.equal(qa.hd_review, true);
    assert.equal(qa.state, 'INCELEME', '🟡 İNCELEME, 🔴 BLOKLU değil');
  });

  test('stand içi robust aykırılık (modified z > 3,5) tek hatalı kaydı yakalar', () => {
    /* 5 kayıt h/D ≈ 28–32 bandında, 1 kayıt 150: sabit bant (15–120) bunu
     * yakalardı ama standın tümü bodur/ya da anıtsal formlu olduğunda sabit
     * bant YANLIŞ kayıtları bayraklar. Robust z her iki durumda da çalışır:
     * ölçüt standın KENDİ dağılımıdır (medyan 30,5 · MAD 1,5 → z = 53,7). */
    const rows = [[40, 12], [40, 12.8], [40, 11.2], [40, 12.4], [40, 11.6], [40, 60]]
      .map((x, i) => mk(i + 1, 'MEŞE', 'YAPRAKLI', x[0], x[1], null));
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.hd_stats.n, 6);
    assert.equal(qa.hd_stats.medyan, 30.5);
    assert.equal(qa.hd_stats.mad, 1.5);
    assert.equal(qa.hd_fail.length, 1, 'yalnız aykırı kayıt: ' + JSON.stringify(qa.hd_fail));
    assert.equal(qa.hd_fail[0].point_id, 6);
    assert.equal(qa.hd_fail[0].reason, 'stand-aykiri');
    assert.ok(qa.hd_fail[0].z > QA_LIMITS.HD_ROBUST_Z, 'z: ' + qa.hd_fail[0].z);
    assert.equal(qa.hd_block, false);
    assert.equal(qa.state, 'INCELEME');
    /* diğer 5 kayıt aykırı DEĞİL (satır düzeyinde de işaretli) */
    assert.deepEqual(qa.rows.filter((r) => r.hd_fail).map((r) => r.point_id), [6]);
  });

  test('ağaç boyu fiziksel aralık dışında (1,3–100 m) → inceleme', () => {
    const rows = [
      mk(1, 'MEŞE', 'YAPRAKLI', 40, 15, null),
      mk(2, 'MEŞE', 'YAPRAKLI', 50, 18, null),
      mk(3, 'MEŞE', 'YAPRAKLI', 200, 120, null), // boy 120 m > H_MAX_M; h/D = 60 (fiziksel bantta)
      mk(4, 'KARAÇAM', 'İBRELİ', 45, 20, null),
      mk(5, 'KARAÇAM', 'İBRELİ', 47, 21, null),
    ];
    const qa = inventoryQa(rows, dict);
    assert.equal(qa.h_fail.length, 1, 'boy fiziksel aralık dışı: ' + JSON.stringify(qa.h_fail));
    assert.equal(qa.h_fail[0].point_id, 3);
    assert.equal(qa.hd_review, true, 'boy kontrolü de inceleme üretir');
    assert.equal(qa.hd_block, false);
    assert.equal(qa.state, 'INCELEME');
    assert.equal(qa.rows.find((r) => r.point_id === 3).h_fail, true);
  });

  test('küçük kayıtlarda yuvarlama gürültüsü bayraklanmaz (mutlak taban ≥5 kg)', () => {
    // Göksu P29 (düzeltilmiş): saklı 10,6 kg; 2 hane DBH ile yeniden hesap
    // ~13,7 kg → %22 sapma GİBİ görünür ama mutlak fark 3,1 kg < 5 kg → gürültü.
    const r = [mk(29, 'IHLAMUR', 'YAPRAKLI', 12.73, 4.5, 10.6)];
    const qa = inventoryQa(r, dict);
    assert.equal(qa.rows[0].dev_fail, false, 'dev: ' + qa.rows[0].dev_pct + '% ama |fark| < 5 kg → bayraklanmamalı');
    assert.equal(qa.dev_fail.length, 0);
    // aynı yüzde büyük kayıtta bayraklanırdı (taban yalnız küçükleri susturur)
    const big = [mk(30, 'IHLAMUR', 'YAPRAKLI', 40, 12, 1000)];
    assert.equal(inventoryQa(big, dict).dev_fail.length, 1);
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

describe('0031 · import-measurements.mjs — cihaz çıktısı kapısı (DBH = göğüs çapı, cm)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'dgi-'));
  /* Göksu 28.09.2026 saha dosyası: ÇAP kolonu (cm) — değerler sahada
   * kaydedildiği gibidir, dönüşüm uygulanmaz. Saklı karbon P3/P7'de bozuk
   * (0011'in yakaladığı ondalık kayması), boy/çap göstergesi 4/4 aralık dışı. */
  const csvCap = [
    'nokta;tur;grup;cap_cm;boy_m;karbon_kg;foto;enlem;boylam',
    '1;SÜS ERİĞİ;YAPRAKLI;110;10,2;2034,7;P001_M1.JPG;39.99025;32.65201',
    '3;SALKIM SÖĞÜT;YAPRAKLI;166;14;6188,3;P003_M1.JPG;39.98989;32.65084',
    '7;KARAÇAM;İBRELİ;107;12;196,2;P007_M1.JPG;39.99111;32.65332',
    '29;IHLAMUR;YAPRAKLI;40;4,5;127,3;P029_M1.JPG;39.99222;32.65443',
  ].join('\n') + '\n';
  /* 0011 dönemi cihaz dosyası: yalnız ÇEVRE kolonu. 0031: bu dosyadan DBH
   * TÜRETİLMEZ — içe aktarma durur (sessiz ÷π dönüşümü yok). */
  const csvCevre = [
    'nokta;tur;grup;cevre_cm;boy_m;karbon_kg;foto;enlem;boylam',
    '1;SÜS ERİĞİ;YAPRAKLI;110;10,2;2034,7;P001_M1.JPG;39.99025;32.65201',
    '7;KARAÇAM;İBRELİ;107;12;196,2;P007_M1.JPG;39.99111;32.65332',
  ].join('\n') + '\n';
  /* Saklı karbonu sistemik bozuk dosya: karbon yeniden hesap kapısı (DBH
   * biriminden BAĞIMSIZ kontrol) bloklamaya devam eder → --force damgası. */
  const csvBozuk = [
    'nokta;tur;grup;cap_cm;boy_m;karbon_kg;enlem;boylam',
    '1;SÜS ERİĞİ;YAPRAKLI;35,01;10,2;203,5;39.99025;32.65201',
    '3;SALKIM SÖĞÜT;YAPRAKLI;52,82;14;618,8;39.98989;32.65084',
    '7;KARAÇAM;İBRELİ;34,06;12;19,6;39.99111;32.65332',
    '29;IHLAMUR;YAPRAKLI;12,73;4,5;127,3;39.99222;32.65443',
  ].join('\n') + '\n';
  /* 0032 · ÇİFT ρ kaynağıyla da SİSTEMİK bozuk dosya: DBH doğru (π ile
   * bölünmemiş), saklı karbon 10x kaymış → 4/4 kayıt her iki ρ kaynağıyla da
   * bant dışı. (csvBozukta π ile bölünmüş DBH + 10x kaymış karbon BİRLİKTE
   * olduğu için iki hata birbirini götürür ve P3 grup ρ ile açıklanabilir
   * hâle gelir; o dosya artık 2/4 = eşikte kalır, blok üretmez.) */
  const csvCokBozuk = [
    'nokta;tur;grup;cap_cm;boy_m;karbon_kg;enlem;boylam',
    '1;SÜS ERİĞİ;YAPRAKLI;110;10,2;203,5;39.99025;32.65201',
    '3;SALKIM SÖĞÜT;YAPRAKLI;166;14;618,8;39.98989;32.65084',
    '7;KARAÇAM;İBRELİ;107;12;196,2;39.99111;32.65332',
    '29;IHLAMUR;YAPRAKLI;40;4,5;12,7;39.99222;32.65443',
  ].join('\n') + '\n';
  const fCap = join(tmp, 'cap.csv'), fCevre = join(tmp, 'cevre.csv'), fBozuk = join(tmp, 'bozuk.csv'), fCokBozuk = join(tmp, 'cokbozuk.csv');
  writeFileSync(fCap, csvCap); writeFileSync(fCevre, csvCevre); writeFileSync(fBozuk, csvBozuk); writeFileSync(fCokBozuk, csvCokBozuk);
  const run = (f, args) => {
    try {
      const out = execFileSync(process.execPath, [join(ROOT, 'scripts/import-measurements.mjs'), f, ...args], { encoding: 'utf8', timeout: 60000 });
      return { code: 0, out };
    } catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
  };

  test('--birim cevre REDDEDİLİR: çevre→çap (÷π) dönüşümü kaldırıldı (0031)', () => {
    const r = run(fCap, ['--birim', 'cevre', '--dry-run']);
    assert.equal(r.code, 2, 'çevre birimi reddedilmeli, çıkış: ' + r.code + '\n' + r.out);
    assert.match(r.out, /KALDIRILDI/);
    assert.match(r.out, /çevre→çap/);
    assert.ok(!r.out.includes('35.01'), 'hiçbir π türetmesi yapılmamalı');
  });

  test('yalnız çevre kolonu olan dosyadan DBH TÜRETİLMEZ → exit 2', () => {
    const r = run(fCevre, ['--dry-run']);
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /TÜRETİLMEZ|çevre→çap/);
    assert.ok(!/insert into/i.test(r.out), 'SQL üretilmemeli');
  });

  test('auto: birim CM, DBH olduğu gibi yazılır, tipik bant dışı oran yalnız ℹ️ BİLGİ (0032)', () => {
    const r = run(fCap, ['--dry-run', '--json']);
    assert.equal(r.code, 0, 'boy/çap göstergesi içe aktarmayı BLOKLAMAMALI: ' + r.out.slice(0, 400));
    const j = JSON.parse(r.out.slice(r.out.indexOf('{')));
    assert.equal(j.unit.unit, 'cm', 'birim cm: ' + j.unit.why);
    assert.match(j.unit.why, /göğüs çapı/);
    assert.match(j.unit.why, /tipik 15–120 bandı dışında → BİLGİ/, 'anıtsal gövde için medyan oran uyarı değil: ' + j.unit.why);
    assert.equal(j.live, 4);
    /* P7: 107 cm çap OLDUĞU GİBİ (0011de 34,06ya bölünüyordu) */
    const p7 = j.records.find((x) => x.point_id === 7);
    assert.equal(p7.dbh_cm, 107, 'DBH dönüştürülmez: ' + p7.dbh_cm);
    assert.equal(p7.girth_cm, null, 'çevre kolonu yoksa girth_cm null');
    assert.ok(!r.out.includes('34.06'), 'π türetmesi izi olmamalı');
    /* (b) gövde formu: fiziksel ihlal YOK; tipik bant dışı 4/4 = SAYIM */
    assert.equal(j.gates.hd.fail, 0, 'fiziksel olarak olanaksız oran yok');
    assert.equal(j.gates.hd.band_out, 4, 'tipik bant dışı sayım: ' + JSON.stringify(j.gates.hd));
    assert.equal(j.gates.hd.block, false, 'boy/çap ASLA bloklamaz (0031)');
    assert.equal(j.gates.hd.review, false, '0032: anıtsal gövde inceleme üretmez');
    /* (c) karbon: P3 grup ρ ile açıklanır (ℹ️), P7nin 10x kayması yakalanır */
    assert.equal(j.gates.dev.fail, 1, 'yalnız gerçek hata: ' + JSON.stringify(j.gates.dev));
    assert.equal(j.gates.dev.rho_grup, 1, 'grup ρ ile eşleşen kayıt');
    assert.equal(j.gates.dev.block, false);
    /* (d) anıtsal gövde sayımı */
    assert.equal(j.gates.anit.threshold_cm, 100);
    assert.equal(j.gates.anit.n, 3, 'P1 110 · P3 166 · P7 107');
    assert.equal(j.gates.anit.max_dbh_cm, 166);
    assert.deepEqual(j.gates.anit.points, [1, 3, 7]);
    assert.match(r.out, /boy\/çap/);
    assert.match(r.out, /ANITSAL GÖVDE/);
    assert.match(r.out, /GRUP VARSAYILANI ρ ile yeniden üretildi/);
    assert.match(r.out, /ÖLÇÜM HATASI DEĞİL/);
    assert.equal(j.blocked, false);
  });

  test('0032 · π ile bölünmüş DBH + 10x kaymış karbon birbirini götürürse P3 grup ρ ile açıklanır', () => {
    /* Bu dosya 0011 hatasının artifacti: iki hata (÷π DBH ve 10x karbon)
     * birlikte olduğundan carbon ∝ d^1,952 telafisiyle P3 grup ρ bandına
     * düşer. Beklenen davranış: P7 ve P29 yakalanır (2/4), eşik (>%50)
     * aşılmadığı için BLOK yok; P3 için ρ kaynağı beyanı basılır. */
    const r = run(fBozuk, ['--dry-run', '--json']);
    assert.equal(r.code, 0, '2/4 = %50 → eşik (>%50) aşılmaz: ' + r.out.slice(0, 300));
    const j = JSON.parse(r.out.slice(r.out.indexOf('{')));
    assert.equal(j.gates.dev.fail, 2);
    assert.deepEqual(j.records.filter((x) => x.dev_pct != null && Math.abs(x.dev_pct) > 500).map((x) => x.point_id), [29]);
    assert.equal(j.gates.dev.rho_grup, 1);
    assert.equal(j.blocked, false);
  });

  test('--birim cm beyanı h/D gerekçesiyle BLOKLANMAZ (0031)', () => {
    const r = run(fCap, ['--birim', 'cm', '--dry-run']);
    assert.equal(r.code, 0, 'cm ısrarı artık meşru: ' + r.out.slice(0, 300));
    assert.ok(!/⛔ QA kapısı BLOK/.test(r.out), 'boy/çap oranı blok gerekçesi olamaz');
    assert.match(r.out, /birim: CM/);
  });

  test('karbon yeniden hesap kapısı (DBH biriminden bağımsız) bloklar; --force damga basar', () => {
    /* 0032: blok yolu ÇİFT ρ kaynağıyla da çalışıyor — 4/4 kayıt her iki
     * kaynakla bant dışı (>%50 VE ≥3 kayıt) → ⛔ BLOK. */
    const r = run(fCokBozuk, ['--dry-run']);
    assert.equal(r.code, 1, 'sistemik saklı-karbon sapması bloklamalı: ' + r.out.slice(0, 300));
    assert.match(r.out, /⛔/);
    assert.match(r.out, /karbon 4\/4 ⛔BLOK/);
    const out = join(tmp, 'forced.sql');
    const r2 = run(fCokBozuk, ['--force', '--park', '25', '--project', '26', '--out', out]);
    assert.equal(r2.code, 0, r2.out.slice(0, 400));
    const sql = readFileSync(out, 'utf8');
    assert.match(sql, /--force ile üretildi/);
    assert.match(sql, /on conflict \(client_id\) do nothing/);
    assert.match(sql, /insert into public\.measurements/);
  });

  test('üretilen SQL: dbh_cm saha değeri (dönüşümsüz), client_id deterministik', () => {
    const out = join(tmp, 'good.sql');
    let r = run(fCap, ['--park', '25', '--project', '26', '--owner', 'ee148cdd-0000-0000-0000-000000000000', '--out', out]);
    /* karbon kapısı (P3/P7 saklı değerleri) bloklarsa --force gerekir */
    if (r.code !== 0) r = run(fCap, ['--force', '--park', '25', '--project', '26', '--owner', 'ee148cdd-0000-0000-0000-000000000000', '--out', out]);
    assert.equal(r.code, 0, r.out.slice(0, 400));
    const sql = readFileSync(out, 'utf8');
    assert.match(sql, /'KARAÇAM', 107, null, 12/, 'P7: dbh 107 cm olduğu gibi, girth null');
    assert.match(sql, /dgi:25:7:1/, 'deterministik client_id');
    assert.match(sql, /birim kararı: cm/, 'SQL başlığı birimi beyan eder');
    assert.ok(!/34\.06/.test(sql), 'π türetmesi SQL\'e sızmamalı');
  });
});

describe('0031 · renderReport — GNSS beyanı, DBH tanımı ve envanter QA satırları', () => {
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
  test('QA v3 satırları çizelgede (0031: birim kontrolü + oran incelemesi ayrı)', () => {
    /* includes kullanılıyor: satır adlarındaki parantezler RegExp'te grup
     * anlamına gelir (test tuzağı belgelensin diye not düşüldü). */
    for (const k of ['Tür sözlüğü eşleşmesi', 'Fotoğraf kanıtı', 'GNSS doğruluk kaydı', 'Envanter birim kontrolü (DBH)', 'Boy/DBH oranı incelemesi', 'Karbon yeniden hesabı'])
      assert.ok(html.includes(k), 'QA satırı eksik: ' + k);
    /* 0011'in "Envanter tutarlılığı (h/d)" satırı ve ⛔ Blok hükmü kalktı */
    assert.ok(!html.includes('Envanter tutarlılığı (h/d)'), 'eski satır adı kalmamalı');
    assert.match(html, /2\/2 kayıt kanonik tür sözlüğüyle eşleşti/);
    /* Birim kontrolü: DBH çap (cm) olarak değerlendirildi, dönüşüm yok */
    assert.match(html, /çevre→çap dönüşümü uygulanmamıştır/);
  });
  test('bbox geom_json beyanı §2 + §4.4 + §7 izlerinde', () => {
    assert.match(html, /dikdörtgen/, 'bbox sınırı beyan edilmeli');
    assert.match(html, /68[.,]93 ha/, 'bbox jeodezik alanı sayıyla');
  });
  test('§4.1 DBH = göğüs çapı (cm) beyanı; çevre→çap dönüşümü YOK (0031)', () => {
    assert.match(html, /göğüs çapı/, 'DBH tanımı göğüs çapı olarak verilmeli');
    assert.match(html, /1,30 m/, 'göğüs yüksekliği beyanı');
    assert.match(html, /herhangi bir çevre→çap dönüşümü uygulanmadan/, 'dönüşüm uygulanmadığı açıkça yazılmalı');
    /* 0011'in yanlış beyanı: DBH çevreden türetilmiş gibi anlatılıyordu */
    assert.ok(!html.includes('DBH = çevre ÷ π'), 'yasak beyan: DBH = çevre ÷ π');
    assert.ok(!/çevre ÷ π/.test(html), 'hiçbir yerde ÷π dönüşümü anlatılmamalı');
  });
  test('§4.6 veri sözlüğü + ölçüm notu: DBH satırı çap (cm)', () => {
    assert.match(html, /Veri sözlüğü/);
    assert.match(html, /Ölçüm notu:/);
    assert.match(html, /göğüs çapı/);
    /* veri sözlüğü tablosunda DBH birimi cm olarak geçmeli */
    const i = html.indexOf('Veri sözlüğü');
    const seg = html.slice(i, i + 4000);
    assert.match(seg, /DBH/);
    assert.match(seg, /cm/);
  });
  test('boy/çap inceleme uyarısı §7 + §9\'da BLOK dili olmadan basılır', () => {
    const reviewQa = { ...qa, hd_review: true, hd_block: false, hd_fail: [{ point_id: 7, hd: 9.7 }, { point_id: 29, hd: 8.8 }], state: 'INCELEME' };
    const snap2 = { ...snap, qa: { species: reviewQa, photos: snap.qa.photos } };
    const h2 = renderReport(snap2, { id: 'DGR-2026-9998', hash: canonicalHash(snap2), version: 1, meta: { id: 'DGR-2026-9998', history: [] } });
    assert.match(h2, /🟡 İNCELEME/);
    assert.match(h2, /İNCELEME GÖSTERGESİDİR/);
    assert.match(h2, /veri hatası hükmü DEĞİLDİR/);
    /* inceleme durumunda GEÇİCİDİR/KULLANILMAMALIDIR damgası BASILMAZ */
    assert.ok(!h2.includes('GEÇİCİDİR'), 'inceleme raporu geçici damgası taşımamalı');
    assert.ok(!h2.includes('KULLANILMAMALIDIR'), 'inceleme raporu kullanım yasağı taşımamalı');
    assert.ok(!h2.includes('⛔'), 'inceleme durumunda ⛔ işareti olmamalı');
  });
  test('kritik hata (DBH geçerlilik) durumunda §7 🔴 BLOKLU + GEÇİCİDİR basar', () => {
    const blockedQa = {
      ...qa, state: 'BLOKLU', dbh_block: true, dbh_review: false,
      dbh_fail: [{ point_id: 7, dbh_cm: null, reason: 'eksik' }, { point_id: 29, dbh_cm: 0, reason: 'pozitif-degil' }, { point_id: 32, dbh_cm: 900, reason: 'aralik-disi' }],
    };
    const snap2 = { ...snap, qa: { species: blockedQa, photos: snap.qa.photos } };
    const h2 = renderReport(snap2, { id: 'DGR-2026-9997', hash: canonicalHash(snap2), version: 1, meta: { id: 'DGR-2026-9997', history: [] } });
    assert.match(h2, /🔴 BLOKLU/);
    assert.match(h2, /GEÇİCİDİR/);
    assert.match(h2, /KULLANILMAMALIDIR/);
    /* blok gerekçesi DBH geçerliliğidir; "çevre olabilir" iddiası DEĞİL */
    assert.match(h2, /DBH/);
    assert.ok(!/çevre olabilir/i.test(h2), 'yasak iddia: DBH çevre olabilir');
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
  test('ρ CASE çalıştırılmış 0011 dosyasıyla birebir (tarihsel kayıt)', () => {
    // 0011_inventory_qa.sql CANLI veride ÇALIŞTIRILDI (28.09.2026): saklı
    // carbon_kg değerleri bu ρ tablosundan türedi. Dosya artık TARİHSEL
    // kayıttır — species.js sonradan değişse bile (0011b: panel listesi
    // eskiye döndü) dosyanın ρ CASE'i uygulandığı günkü haliyle sabittir.
    // Bu test o içeriği kilitler: yeniden üretim/senkron BEKLENMEZ.
    const EXECUTED_RHO_0011 = {
      'AĞLAYAN SÖĞÜT': 400, 'AKÇAAĞAÇ': 540, 'AMBERAĞACI': 520, 'ARDIÇ': 460,
      'AT KESTANESİ': 490, 'ATLAS SEDİRİ': 490, 'CEVİZ': 560, 'ÇINAR': 600,
      'DİŞBUDAK': 562, 'DOĞU ÇINARI': 600, 'DUT': 570, 'FISTIK ÇAMI': 470,
      'GLEDİÇYA': 600, 'GÖKNAR': 350, 'GÜMÜŞ LADİN': 450, 'GÜRGEN': 630,
      'HALEP ÇAMI': 480, 'HİMALAYA SEDİRİ': 430, 'HUŞ': 540, 'IHLAMUR': 420,
      'KARAAĞAÇ': 570, 'KARAÇAM': 470, 'KATALPA': 400, 'KAVAK': 350,
      'KAYIN': 530, 'KESTANE': 500, 'KIZILAĞAÇ': 407, 'KIZILÇAM': 478,
      'KRİPTOMERYA': 350, 'LADİN': 358, 'MANOLYA': 500, 'MAVİ LADİN': 450,
      'MAZI (YALANCI SERVİ)': 450, 'MEŞE': 570, 'PORSUK': 640,
      'SALKIM SÖĞÜT': 400, 'SARIÇAM': 426, 'SEDİR': 430, 'SERVİ': 510,
      'SIĞLA': 468, 'SÖĞÜT': 410, 'SÜS ELMASI': 650, 'SÜS ERİĞİ': 630,
      'YALANCI AKASYA': 660,
    };
    for (const [k, v] of Object.entries(EXECUTED_RHO_0011))
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
