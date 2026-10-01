/* fix-0043.test.mjs — İKİ KÖK DÜZELTMENİN KİLİDİ
 *
 * (1) ONAY/RED KAYDIRMA SIÇRAMASI (kullanıcı: "şuradaki sıçramayı çöz artık
 *     yeter … 3-4 veriyi onaylarken sorun yaşıyorum").
 *     KÖK NEDEN: loadAdminTree() her yenilemede ağacı KOŞULSUZ tek satır
 *     "⏳ yükleniyor"a çökertiyordu → belge yüksekliği aniden küçülünce
 *     tarayıcı window.scrollY'yi kırpıyor, ekran yukarı fırlıyordu. 0040/0041
 *     sarmalları bunu yakalayamadı çünkü çökme, sarmalın DIŞINDA ve await'ten
 *     ÖNCE oluyordu. ÇÖZÜM: (a) yükleniyor mesajı yalnız İLK yüklemde (kutu
 *     boşken) — yenilemede ağaç ekranda kalır (çökme yok); (b) kaydırma tüm
 *     işlem boyunca yakalanır/geri konur; (c) onay/red/sil İYİMSER: satır yerel
 *     önbellekte güncellenip ağaç YERİNDE çizilir (ağ turu yok, anlık, sıçrama
 *     yok), tam mutabakat sekmeli (debounced) arka plan tazelemesiyle gelir.
 *
 * (2) AĞAÇ ALGILAMA bölümü 0044'te KALDIRILDI: harici model soketi, yerleşik
 *     sezgisel algılayıcı ve 🤖 yönetim kartı kullanıcı kararıyla kökten
 *     silindi; bekçileri tersine çevrilmiş hâlde test/fix-0044.test.mjs'te.
 *     SW sürüm sözleşmesi de orada (r52).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

const tree = rd('src/services/admin-tree.js');
const admin = rd('src/services/admin.js');

/* ══════════ (1) KAYDIRMA SIÇRAMASI — STATİK KİLİT ══════════ */
describe('0043 · onay/red kaydırma sıçraması kök düzeltmesi', () => {
  test('⭐ loadAdminTree yenilemede ağacı ÇÖKERTMİYOR (yükleniyor yalnız ilk yüklemde)', () => {
    const fn = tree.slice(tree.indexOf('async function loadAdminTree'), tree.indexOf('/* Filtrelenmiş ağacı çiz'));
    assert.match(fn, /const hasTree=box&&box\.querySelector/, 'kutuda zaten ağaç var mı diye bakılmalı');
    assert.match(fn, /if\(box&&!hasTree\)/, 'yükleniyor mesajı YALNIZ kutu boşken (koşullu)');
    /* ESKİ kök neden: koşulsuz çökertme. Geri gelmemeli. */
    assert.ok(!/if\(box\)box\.innerHTML=`<div class="alert info">⏳ Ölçümler yükleniyor/.test(tree),
      'koşulsuz "⏳ yükleniyor" çökertmesi geri gelmemeli (sıçramanın kökü)');
  });

  test('⭐ loadAdminTree kaydırmayı tüm işlem boyunca koruyor (başta yakala · sonda geri koy)', () => {
    const fn = tree.slice(tree.indexOf('async function loadAdminTree'), tree.indexOf('/* Filtrelenmiş ağacı çiz'));
    assert.match(fn, /dgScrollKeep/, 'işlemin başında kaydırma yakalanmalı');
    assert.match(fn, /dgScrollRestore\(_y\)/, 'çizimden SONRA kaydırma geri konmalı');
    /* "yükleniyor"da asılı kalma koruması (0042 kilidi) bozulmadı */
    assert.match(fn, /try\{\s*res=await dgTreeFetch\(\);/);
    assert.match(fn, /beklenmedik sorgu hatası/);
    assert.match(fn, /çizim hatası/);
  });

  test('⭐ iyimser onay/red/sil: yerel önbellek + YERİNDE çizim (ağdan yeniden çekme yok)', () => {
    assert.match(tree, /function dgTreeApplyStatus/, 'durum güncelleyici');
    assert.match(tree, /function dgTreeRemoveRow/, 'silme güncelleyicisi');
    assert.match(tree, /window\.dgTreeApplyStatus=dgTreeApplyStatus/, 'global kaydı');
    assert.match(tree, /window\.dgTreeRemoveRow=dgTreeRemoveRow/, 'global kaydı');
    /* admin.js: onay/red/sil iyimser yolu çağırıyor, yedeğe de düşüyor */
    assert.match(admin, /dgTreeApplyStatus\(id,"Onaylı",true\)/, 'approveMeas iyimser');
    assert.match(admin, /dgTreeApplyStatus\(id,"Red",false\)/, 'rejectMeas iyimser');
    assert.match(admin, /dgTreeRemoveRow\(id\)/, 'delMeas iyimser');
    assert.match(admin, /loadAdmin\(\)/, 'önbellek boşsa tam yükleme yedeği korunmalı');
  });

  test('⭐ canlı harita bayat işaretleniyor + tam mutabakat SEKMELİ (debounced) arka planda', () => {
    for (const fn of ['approveMeas', 'rejectMeas', 'delMeas']) {
      const i = admin.indexOf('async function ' + fn);
      assert.ok(i > -1, fn + ' bulunamadı');
      const govde = admin.slice(i, admin.indexOf('\nasync function', i + 10) === -1 ? admin.length : admin.indexOf('\nasync function', i + 10));
      assert.match(govde, /dgMarkLiveDirty\(\)/, fn + ' dgMarkLiveDirty() çağırmalı');
    }
    assert.match(admin, /function dgAdminSyncSoon/, 'sekmeli arka plan mutabakatı');
    assert.match(admin, /setTimeout\(/, 'debounce zamanlayıcısı');
    assert.match(admin, /function dgRenderFlatTable/, 'düz liste çizimi tek yerde (yeniden kullanılabilir)');
  });

  test('⭐ İYİMSER GÜNCELLEYİCİLER gerçekten çalışıyor (vm · yerel satır durumu)', () => {
    const { dgTreeApplyStatus, dgTreeRemoveRow, dgTreeRows } = loadApp();
    assert.equal(typeof dgTreeApplyStatus, 'function');
    assert.equal(typeof dgTreeRemoveRow, 'function');
    /* Yerel önbelleği tek satırla tohumla (dgTreeRows() canlı diziyi döndürür). */
    dgTreeRows().push({
      id: 5, owner: 'u1', project_id: 1, park_id: 1, carbon_kg: 10, status: 'Beklemede',
      species: 'Meşe', grp: 'YAPRAKLI', point_id: 1, measurement_no: 1, dbh_cm: 20, height_m: 7,
      created_at: '2026-09-01', photo_url: null,
      profiles: { full_name: 'Ayşe Yılmaz' },
      projects: { id: 1, name: 'Göksu - deneme', park_id: 1, park_name: 'Göksu', parks: { id: 1, name: 'Göksu Parkı', area_m2: 42000, city: 'Ankara', country: 'TR' } },
    });
    /* Onayla: satır bulunur → true döner, yerel durum güncellenir. */
    assert.equal(dgTreeApplyStatus(5, 'Onaylı', true), true, 'var olan satır güncellenmeli');
    assert.equal(dgTreeRows()[0].status, 'Onaylı', 'yerel önbellekte durum Onaylı olmalı');
    assert.equal(dgTreeRows()[0].shared, true, 'shared bayrağı da güncellenmeli');
    /* Olmayan satır → false (çağıran tam yüklemeye düşer). */
    assert.equal(dgTreeApplyStatus(999, 'Red', false), false, 'olmayan satır false dönmeli');
    /* Reddet aynı satırda. */
    assert.equal(dgTreeApplyStatus(5, 'Red', false), true);
    assert.equal(dgTreeRows()[0].status, 'Red');
    /* Sil: satır önbellekten düşer. */
    assert.equal(dgTreeRemoveRow(5), true, 'silme true dönmeli');
    assert.equal(dgTreeRows().length, 0, 'satır önbellekten kaldırılmalı');
    assert.equal(dgTreeRemoveRow(5), false, 'yok olan satırı silme false dönmeli');
  });
});
