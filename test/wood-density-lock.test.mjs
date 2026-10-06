/* wood-density-lock.test.mjs — nihai, tek-kaynak odun yoğunluğu sözleşmesi. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadApp } from '../scripts/test-harness.mjs';

const app = loadApp();
const lock = app.DG_WOOD_DENSITY_LOCK;
const byKey = Object.fromEntries(Array.from(lock.rows, (r) => [r.key, r]));
const FINAL_FINGERPRINT = '1312379570ccf39d4ca6a3dbd7eb3fef0ba894dd12d34cfe87ee39cb0ab480cc';

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

function fingerprint(){
  const payload={
    unit:lock.unit,
    groups:Array.from(lock.groups),
    defaults:{'İBRELİ':lock.defaults['İBRELİ'],'YAPRAKLI':lock.defaults['YAPRAKLI']},
    rows:Array.from(lock.rows,r=>({
      key:r.key,tr:r.tr,taxon:r.taxon,rho_t_m3:r.rho_t_m3,rho:r.rho,source:r.source
    }))
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

describe('DG-WD-LOCK-2026-10-06-FINAL', () => {
  test('nihai kimlik, iki grup ve SHA-256 parmak izi değişmez', () => {
    assert.equal(lock.id, 'DG-WD-LOCK-2026-10-06-FINAL');
    assert.equal(lock.fingerprint, FINAL_FINGERPRINT);
    assert.equal(fingerprint(), FINAL_FINGERPRINT);
    assert.equal(lock.unit, 'kg/m3');
    assert.equal(Array.from(lock.groups).join('|'), 'İBRELİ|YAPRAKLI');
    assert.equal(lock.defaults['İBRELİ'], 446);
    assert.equal(lock.defaults['YAPRAKLI'], 541);
    assert.equal(lock.defaults['DİĞER'], undefined);
    assert.equal(Object.isFrozen(lock), true);
    assert.equal(Object.isFrozen(lock.rows), true);
    assert.equal(Object.isFrozen(lock.groups), true);
    assert.equal(Object.isFrozen(lock.defaults), true);
    assert.ok(Array.from(lock.rows).every((r) => Object.isFrozen(r)));
  });

  test('18 kanonik satırın sıra, yoğunluk ve kaynakları birebir korunur', () => {
    assert.equal(lock.rows.length, EXPECTED.length);
    assert.equal(Array.from(lock.rows, (r) => r.key).join('|'), EXPECTED.map((r) => r[0]).join('|'));
    for (const [key, rho, source] of EXPECTED) {
      assert.ok(byKey[key], key + ' eksik');
      assert.equal(byKey[key].rho, rho, key + ' yoğunluğu değişti');
      assert.equal(byKey[key].rho_t_m3, rho / 1000, key + ' ton/m3 dönüşümü bozuk');
      assert.equal(byKey[key].source, source, key + ' kaynağı değişti');
    }
  });

  test('tür kataloğu yalnız İBRELİ/YAPRAKLIdır; yeni özel rho eklenemez', () => {
    assert.equal(Object.keys(app.SPECIES_DATA).sort().join('|'), ['YAPRAKLI','İBRELİ'].sort().join('|'));
    const lockedSpecies = new Map(EXPECTED.filter(([k])=>!k.startsWith('GROUP:')).map(([k,r])=>[k,r]));
    for (const [grp,list] of Object.entries(app.SPECIES_DATA)) {
      assert.ok(['İBRELİ','YAPRAKLI'].includes(grp));
      for (const row of list) {
        const locked = lockedSpecies.get(row.tr);
        if (locked != null) assert.equal(row.rho, locked, row.tr + ' kilitli rho ile eşleşmeli');
        else assert.equal(row.rho, null, row.tr + ' yeni/tablo dışı tür yalnız grup genelini kullanabilir');
      }
    }
  });

  test('DİĞER, bilinmeyen tür ve yanlış grup karbon üretemez', () => {
    for (const [sp,grp] of [['DİĞER','DİĞER'],['OLMAYAN TÜR','YAPRAKLI'],['KARAÇAM','YAPRAKLI'],['SÜS ERİĞİ','İBRELİ']]) {
      assert.equal(app.densityKgFor(sp,grp), null, sp+' / '+grp);
      const r=app.calc(30,20,sp,grp);
      assert.equal(r.valid,false);
      assert.equal(r.total_carbon,0);
      assert.equal(r.density_kg_m3,null);
    }
  });

  test('tablo dışı bilinen tür yalnız kendi grup genelini kullanır', () => {
    assert.equal(app.densityKgFor('CEVİZ','YAPRAKLI'),541);
    assert.equal(app.densityKgFor('MAVİ LADİN','İBRELİ'),446);
    assert.equal(app.rho['CEVİZ'],undefined);
    assert.equal(app.rho['MAVİ LADİN'],undefined);
  });

  test('SIĞLA özel rho taşımaz; 57 cm × 7,5 m = 418,419108 kg C', () => {
    assert.equal(app.rho['SIĞLA'], undefined);
    assert.equal(app.resolveSpeciesName('Sığla'), 'SIĞLA');
    assert.equal(app.resolveSpeciesName('SIGLA'), 'SIĞLA');
    assert.equal(app.resolveSpeciesName('Liquidambar orientalis'), 'SIĞLA');
    assert.equal(app.densityKgFor('SIĞLA','YAPRAKLI'),541);
    const r=app.calc(57,7.5,'SIĞLA','YAPRAKLI');
    assert.equal(r.valid,true);
    assert.equal(r.density_kg_m3,541);
    assert.ok(Math.abs(r.total_carbon-418.41910806687343)<1e-9);
  });

  test('Ağlayan Söğüt gizli rho kaydı değildir; Salkım Söğüt eşanlamlısıdır', () => {
    assert.equal(app.resolveSpeciesName('Ağlayan Söğüt'),'SALKIM SÖĞÜT');
    assert.equal(app.densityKgFor('Ağlayan Söğüt','YAPRAKLI'),541);
    assert.equal(app.rho['AĞLAYAN SÖĞÜT'],undefined);
  });
});
