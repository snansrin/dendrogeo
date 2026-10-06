/* wood-density-lock.test.mjs — kullanıcı onaylı kanonik odun yoğunluğu tablosu.
 * Bu test yanlışlıkla tür eklerken yoğunluk değiştirilmesini engeller.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from '../scripts/test-harness.mjs';

const app = loadApp();
const lock = app.DG_WOOD_DENSITY_LOCK;
const byKey = Object.fromEntries(Array.from(lock.rows, (r) => [r.key, r]));

const EXPECTED = [
 ['GROUP:İBRELİ', 446, 'Tolunay, 2013; NIR Turkey, 2017; 299 Nolu Tebliğ, 2017'],
 ['GÖKNAR', 350, 'As ve ark., 2001'],
 ['HİMALAYA SEDİRİ', 430, 'Bozkurt ve Erdin (2000), Demetçi (1986)'],
 ['SEDİR', 430, 'As ve ark., 2001'],
 ['ARDIÇ', 460, 'As ve ark., 2001'],
 ['LADİN', 358, 'As ve ark., 2001'],
 ['KIZILÇAM', 478, 'As ve ark., 2001'],
 ['HALEP ÇAMI', 480, 'Erten ve Sözen, 1997b'],
 ['KARAÇAM', 470, 'As ve ark., 2001'],
 ['FISTIK ÇAMI', 470, 'Erten ve Sözen, 1997a'],
 ['SARIÇAM', 426, 'As ve ark., 2001'],
 ['GROUP:YAPRAKLI', 541, 'Tolunay, 2013; NIR Turkey, 2017; 299 Nolu Tebliğ, 2017'],
 ['KIZILAĞAÇ', 407, 'As ve ark., 2001'],
 ['GÜRGEN', 630, 'IPCC, 2003'],
 ['KAYIN', 530, 'As ve ark., 2001'],
 ['DİŞBUDAK', 562, 'Gürsu, 1971'],
 ['KAVAK', 350, 'IPCC, 2003'],
 ['MEŞE', 570, 'As ve ark., 2001'],
];

describe('DG-WD-LOCK-2026-10-06-v2', () => {
  test('kilit kimliği ve satır sayısı değişmez', () => {
    assert.equal(lock.id, 'DG-WD-LOCK-2026-10-06-v2');
    assert.equal(lock.unit, 'kg/m3');
    assert.equal(lock.rows.length, EXPECTED.length);
    assert.equal(Object.isFrozen(lock), true);
    assert.equal(Object.isFrozen(lock.rows), true);
    assert.ok(Array.from(lock.rows).every((r) => Object.isFrozen(r)));
  });

  test('18 kanonik satırın yoğunluk ve kaynakları birebir korunur', () => {
    assert.equal(Array.from(lock.rows, (r) => r.key).join('|'), EXPECTED.map((r) => r[0]).join('|'));
    for (const [key, rho, source] of EXPECTED) {
      assert.ok(byKey[key], key + ' eksik');
      assert.equal(byKey[key].rho, rho, key + ' yoğunluğu değişti');
      assert.equal(byKey[key].rho_t_m3, rho / 1000, key + ' ton/m3 dönüşümü bozuk');
      assert.equal(byKey[key].source, source, key + ' kaynağı değişti');
    }
  });

  test('tablo dışı sonradan eklenen türler özel rho alamaz', () => {
    for (const name of ['ATLAS SEDİRİ', 'MAVİ LADİN', 'DOĞU ÇINARI', 'SALKIM SÖĞÜT', 'CEVİZ', 'SIĞLA']) {
      assert.equal(app.rho[name], undefined, name + ' kanonik tabloda yok; özel rho verilmemeli');
    }
  });

  test('SIĞLA özel rho taşımaz; her yazım yolunda YAPRAKLI genel 541 kg/m3 kullanır', () => {
    assert.equal(app.rho['SIĞLA'], undefined);
    assert.equal(app.resolveSpeciesName('Sığla'), 'SIĞLA');
    assert.equal(app.resolveSpeciesName('SIGLA'), 'SIĞLA');
    assert.equal(app.resolveSpeciesName('Liquidambar orientalis'), 'SIĞLA');

    const carbon = (rhoKg, D, H) => {
      const agb = 0.0673 * Math.pow((rhoKg / 1000) * D * D * H, 0.976);
      return (agb + agb * 0.26) * 0.47;
    };
    const beklenen = carbon(541, 57, 7.5);
    assert.ok(Math.abs(beklenen - 418.41910806687343) < 1e-9);
    for (const sp of ['SIĞLA', 'Sığla', 'SIGLA', 'Liquidambar orientalis']) {
      const r = app.calc(57, 7.5, sp, 'YAPRAKLI');
      assert.ok(Math.abs(r.total_carbon - beklenen) < 1e-9, sp + ' YAPRAKLI genel rho kullanmadı');
    }
  });

  test('tablo dışı yapraklı/ibreli türler kilitli grup varsayılanına düşer', () => {
    const agb = (rhoKg, D, H) => 0.0673 * Math.pow((rhoKg / 1000) * D * D * H, 0.976);
    assert.ok(Math.abs(app.calc(30, 20, 'CEVİZ', 'YAPRAKLI').agb - agb(541, 30, 20)) < 1e-9);
    assert.ok(Math.abs(app.calc(30, 20, 'MAVİ LADİN', 'İBRELİ').agb - agb(446, 30, 20)) < 1e-9);
  });
});
