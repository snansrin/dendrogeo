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
 * (2) AĞAÇ ALGILAMA (kullanıcı: "ağaç algılamayı da düzelt").
 *     KÖK NEDEN: algılama YALNIZ dış uç nokta soketiydi; uç nokta (c.on+c.url)
 *     verilmediyse dgAiOnPhoto HİÇBİR ŞEY yapmıyordu → "🤖 AI Ağaç Algılama"
 *     kartı ölü/bozuk görünüyordu. ÇÖZÜM: uç nokta yoksa TARAYICIDA çalışan
 *     YERLEŞİK çevrimdışı sezgisel algılayıcı (dgAiBuiltin) devreye girer.
 *     Yerleşik sonuç YALNIZ UYARIDIR (advisory) — kaydı ASLA engellemez; sert
 *     kapı (photoOk=false) yalnız gerçek model + admin izniyle tetiklenir.
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
const ai = rd('src/services/species-ai.js');
const idx = rd('index.html');
const sh = rd('partials/shell.html');

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

/* ══════════ (2) YERLEŞİK AĞAÇ ALGILAMA — STATİK KİLİT ══════════ */
describe('0043 · yerleşik çevrimdışı ağaç algılayıcı', () => {
  test('⭐ dgAiBuiltin var (uç nokta olmadan da algılama ÇALIŞIR)', () => {
    assert.match(ai, /async function dgAiBuiltin/, 'yerleşik sezgisel algılayıcı');
    assert.match(ai, /getImageData/, 'piksel düzeyinde sezgi (canvas)');
    assert.match(ai, /function dgAiTestBuiltin/, 'yönetim kartından denenebilir');
  });

  test('⭐ dgAiOnPhoto uç nokta YOKSA yerleşik algılayıcıya düşüyor', () => {
    assert.match(ai, /const ext=dgAiEnabled\(\)/, 'dış uç nokta modu');
    assert.match(ai, /const builtin=\(c\.builtin!==false\)/, 'yerleşik varsayılan AÇIK');
    assert.match(ai, /await dgAiBuiltin\(file\)/, 'yerleşik algılayıcı çağrılıyor');
    /* Uç nokta çökerse (ağ/CSP/CORS) yerleşik yedeğe düşer — saha işi durmaz. */
    assert.match(ai, /b\.advisory=true/, 'uç nokta yedeği de advisory');
  });

  test('⭐ yerleşik sonuç YALNIZ UYARI (advisory) — kaydı ASLA engellemez', () => {
    /* Sert kapı (photoOk=false) yalnız gerçek model + !advisory + admin izniyle. */
    assert.match(ai, /if\(!advisory&&c\.block\)\{try\{photoOk=false;\}/, 'kapı yalnız gerçek modelde');
    assert.match(ai, /photoOk=false/, 'AI kapısı korunuyor (0042 kilidi)');
    /* treeOk advisory iken doğrudan res.tree; eşik/kapı uygulanmaz. */
    assert.match(ai, /const treeOk=advisory\?\!\!res\.tree:dgAiOk\(res\)/, 'advisory → eşik kapısı yok');
  });

  test('⭐ yönetim kartı yerleşik algılayıcıyı önde sunuyor (aç/kapa + dene)', () => {
    assert.match(ai, /id="dgAiBuiltin"/, 'yerleşik aç/kapa kutusu');
    assert.match(ai, /Yerleşik ağaç algılama/, 'yerleşik etiketi');
    assert.match(ai, /onclick="dgAiTestBuiltin\(\)"/, 'yerleşik deneme düğmesi');
    assert.match(ai, /c\.builtin=!\(bi&&!bi\.checked\)/, 'yerleşik ayarı kalıcı (varsayılan açık)');
    assert.match(sh, /AI Ağaç Algılama/, 'kart başlığı ağaç modunda');
  });

  test('⭐ AI modülü veritabanına DOKUNMAZ (kırmızı çizgi korunuyor)', () => {
    assert.ok(!/insert|upsert|\.from\(/.test(ai), 'AI modülünde DB çağrısı olamaz');
    assert.ok(!/function dgAiUse/.test(ai), 'tür ön-doldurma geri gelmemeli');
    assert.match(rd('src/services/measure.js'), /dgAiOnPhoto\(f\)/, 'fotoğraf QA kancası duruyor');
  });

  test('i18n: yeni yerleşik algılama dizeleri EN sözlüğünde (benzersiz)', () => {
    const i18n = rd('src/config/i18n.js');
    for (const s of [
      'Yerleşik ağaç algılama (çevrimdışı · model gerektirmez · yalnız uyarı, kaydı engellemez)',
      'Ağaç algılanıyor (yerleşik · çevrimdışı)…',
      'yerleşik algılayıcı',
      '🌳 Yerleşik algılayıcıyı dene',
    ]) assert.ok(i18n.includes(JSON.stringify(s) + ':'), 'eksik EN girdisi: ' + s);
  });
});

/* ══════════ içerik sözleşmesi: SW r51 (önbeklenen içerik değişti) ══════════ */
describe('0043 · çevrimdışı paket sürümü', () => {
  test('sw.js r51 (admin/admin-tree/species-ai değişti → sürüm arttı)', () => {
    assert.match(rd('sw.js'), /CACHE_VERSION = 'dendrogeo-sw-v2-r51'/);
    assert.match(idx, /species-ai\.js\?v=[0-9a-f]{8}/, 'index hash tazelenmiş');
  });
});
