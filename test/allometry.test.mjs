/* allometry.test.mjs — Karbon hesabının bilimsel çekirdeği.
 *
 * Bu dosya projenin en kritik doğrulama katmanıdır: calc() çıktısı doğrudan
 * yayınlanan karbon rakamlarını üretir. Formül, odun yoğunluğu (rho) fallback
 * zinciri ve birim dönüşümleri burada kilitlenir.
 *
 * Not: Türkçe metinlerde kesme işareti kullanılmıyor; bu dosya tek tırnaklı
 * dizeler içerdiği için apostrof sözdizimini bozuyor.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from '../scripts/test-harness.mjs';

const app = loadApp();
const { calc } = app;

/* Elle hesaplanmış referans değerler — formülün bağımsız yeniden yazımı.
 * 0.0673 * (rho_t * D^2 * H)^0.976 ; rho_t = rho_kg_m3 / 1000 */
const agb = (rhoKg, D, H) => 0.0673 * Math.pow((rhoKg / 1000) * D * D * H, 0.976);

describe('calc() — Chave vd. (2014) AGB formülü', () => {
  test('Kızılçam D=30 cm H=20 m → 465.889 kg AGB', () => {
    const r = calc(30, 20, 'KIZILÇAM', 'İBRELİ');
    assert.ok(Math.abs(r.agb - agb(478, 30, 20)) < 1e-6, 'agb=' + r.agb);
    // Beklenen değer elle yazılmış sabitle DEĞİL, formülün bağımsız yeniden
    // yazımıyla karşılaştırılıyor (agb yardımcısı). Sebep: uygulama rho/1000
    // bölmesi yapıyor; 0.478 sabitini elle yazınca son basamakta ~2.4e-6 mutlak
    // (~5e-9 bağıl) kayan nokta farkı kalıyor ve sıkı tolerans yanlış alarm verir.
    assert.equal(r.agb, agb(478, 30, 20));
    // Büyüklük denetimi: formül katsayısı veya birimler bozulursa bu patlar.
    assert.ok(Math.abs(r.agb - 465.88921674) / 465.88921674 < 1e-6, 'agb=' + r.agb);
  });

  test('kök biyokütlesi AGB üzerinden %26 oranında', () => {
    const r = calc(40, 25, 'MEŞE', 'YAPRAKLI');
    assert.ok(Math.abs(r.bhb / r.agb - 0.26) < 1e-9);
    assert.ok(Math.abs(r.bio - (r.agb + r.bhb)) < 1e-9);
  });

  test('karbon oranı 0.47 (IPCC) tutarlı uygulanıyor', () => {
    const r = calc(35, 22, 'KAYIN', 'YAPRAKLI');
    assert.ok(Math.abs(r.c_agb - r.agb * 0.47) < 1e-9);
    assert.ok(Math.abs(r.c_bhb - r.bhb * 0.47) < 1e-9);
    assert.ok(Math.abs(r.total_carbon - r.bio * 0.47) < 1e-9);
    // iç tutarlılık: parçaların toplamı bütüne eşit olmalı
    assert.ok(Math.abs(r.c_agb + r.c_bhb - r.total_carbon) < 1e-9);
  });

  test('hacim = silindir x 0.5 gövde form faktörü', () => {
    const r = calc(30, 20, 'KIZILÇAM', 'İBRELİ');
    const beklenen = Math.PI * Math.pow(30 / 200, 2) * 20 * 0.5;
    assert.ok(Math.abs(r.vol - beklenen) < 1e-9, 'vol=' + r.vol);
  });
});

describe('calc() — sınır ve geçersiz girdiler', () => {
  const SIFIR = { agb: 0, bhb: 0, bio: 0, c_agb: 0, c_bhb: 0, total_carbon: 0, vol: 0 };

  const durumlar = [
    ['dbh=0', 0, 20],
    ['h=0', 30, 0],
    ['dbh negatif', -5, 20],
    ['h negatif', 30, -3],
    ['dbh null', null, 20],
    ['h undefined', 30, undefined],
    ['dbh NaN', NaN, 20],
    ['ikisi de NaN', NaN, NaN],
  ];

  for (const [ad, dbh, h] of durumlar) {
    test(ad + ' → tüm alanlar sıfır, NaN yayılmıyor', () => {
      const r = calc(dbh, h, 'MEŞE', 'YAPRAKLI');
      // assert.deepEqual KULLANILMIYOR: dönen nesne node:vm bağlamının
      // realm'inden geliyor ve Object.prototype'ı farklı. Node bu durumda
      // "Values have same structure but are not reference-equal" hatası verir.
      // Anahtar kümesini ve değerleri ayrı ayrı karşılaştırıyoruz.
      assert.deepEqual(Object.keys(r).sort(), Object.keys(SIFIR).sort());
      for (const [k, v] of Object.entries(SIFIR)) {
        assert.equal(r[k], v, k + ' = ' + r[k] + ' olmalıydı');
      }
      for (const [k, v] of Object.entries(r)) {
        assert.ok(Number.isFinite(v), k + ' sonlu değil: ' + v);
      }
    });
  }
});

describe('rho fallback zinciri — tür → grup → DİĞER', () => {
  test('rho değeri bilinen tür kendi değerini kullanır', () => {
    assert.equal(app.rho['KIZILÇAM'], 478);
    const r = calc(30, 20, 'KIZILÇAM', 'İBRELİ');
    assert.ok(Math.abs(r.agb - agb(478, 30, 20)) < 1e-6);
  });

  test('rho değeri null olan tür grup varsayılanına düşer', () => {
    // SERVİ species.js içinde rho:null → İBRELİ varsayılanı 446
    assert.equal(app.rho['SERVİ'], undefined, 'rho:null olan tür haritaya yazılmamalı');
    const r = calc(30, 20, 'SERVİ', 'İBRELİ');
    assert.ok(Math.abs(r.agb - agb(446, 30, 20)) < 1e-6, 'agb=' + r.agb);
  });

  test('tamamen bilinmeyen tür de grup varsayılanına düşer, çökmüyor', () => {
    const r = calc(30, 20, 'BOYLE_BIR_TUR_YOK', 'YAPRAKLI');
    assert.ok(Math.abs(r.agb - agb(541, 30, 20)) < 1e-6);
  });

  test('grup da tanınmıyorsa DİĞER (493) kullanılır', () => {
    const r = calc(30, 20, 'X', 'TANIMSIZ_GRUP');
    assert.ok(Math.abs(r.agb - agb(493, 30, 20)) < 1e-6);
  });

  test('CANARY: 45 tür kaydının 28 kadarında rho yok — veri kalitesi borcu', () => {
    // Bu test bilinçli olarak MEVCUT DURUMU belgeler. rho tablosu
    // dolduruldukça `bos` sayısı düşmeli; o zaman bu test güncellenir.
    // Bir gerileme değil, ilerleme işaretidir.
    const hepsi = Object.values(app.SPECIES_DATA).flat();
    const bos = hepsi.filter((s) => !s.rho).length;
    assert.equal(hepsi.length, 45, 'tür kaydı sayısı değişti');
    assert.equal(bos, 28, 'rho eksik tür sayısı ' + bos + ' oldu — tabloyu doldurduysanız bu testi güncelleyin');
  });
});

describe('calc() — monotonluk (fiziksel tutarlılık)', () => {
  test('çap arttıkça biyokütle artar', () => {
    let once = 0;
    for (const d of [5, 10, 20, 40, 80, 150]) {
      const v = calc(d, 20, 'KIZILÇAM', 'İBRELİ').agb;
      assert.ok(v > once, 'D=' + d + ' için agb=' + v + ' önceki ' + once + ' değerini aşmadı');
      once = v;
    }
  });

  test('boy arttıkça biyokütle artar', () => {
    let once = 0;
    for (const h of [3, 8, 15, 25, 40]) {
      const v = calc(30, h, 'KIZILÇAM', 'İBRELİ').agb;
      assert.ok(v > once, 'H=' + h + ' için agb=' + v + ' önceki ' + once + ' değerini aşmadı');
      once = v;
    }
  });

  test('yoğunluk arttıkça biyokütle rho^0.976 ile ölçeklenir', () => {
    const hafif = calc(30, 20, 'GÖKNAR', 'İBRELİ').agb;   // rho=350
    const agir = calc(30, 20, 'KIZILÇAM', 'İBRELİ').agb;  // rho=478
    assert.ok(agir > hafif);
    const beklenenOran = Math.pow(478 / 350, 0.976);
    assert.ok(Math.abs(agir / hafif - beklenenOran) < 1e-6);
  });
});
