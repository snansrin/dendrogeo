import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const rd=(p)=>readFileSync(join(ROOT,p),'utf8');

describe('DBH sunum standardı',()=>{
 test('hesap hassasiyeti korunur; kullanıcı arayüzleri DBHyi 1 ondalık gösterir',()=>{
  const measure=rd('src/services/measure.js');
  const dash=rd('src/services/dash.js');
  const map=rd('src/services/map.js');
  const admin=rd('src/services/admin.js');
  const tree=rd('src/services/admin-tree.js');
  assert.match(measure,/r\.dbh_cm\.toFixed\(1\)/);
  assert.match(dash,/\(\+r\.dbh_cm\)\.toFixed\(1\)/);
  assert.match(map,/\(\+r\.dbh_cm\)\.toFixed\(1\)/);
  assert.match(admin,/\(\+x\.dbh_cm\)\.toFixed\(1\)/);
  assert.match(tree,/\(\+r\.dbh_cm\)\.toFixed\(1\)/);
 });
 test('rapor, CSV ve okunabilir GeoJSON DBHyi 1 ondalık sunar',()=>{
  const r=rd('scripts/make-report.mjs');
  assert.match(r,/rapor tablolarında DBH 1 ondalık basamakla gösterilir/);
  assert.match(r,/\(\+r\.dbh_cm\)\.toFixed\(1\)/);
  const ex=rd('src/services/export.js');
  assert.match(ex,/const dbh=Number\.isFinite\(\+r\.dbh_cm\)\?\(\+r\.dbh_cm\)\.toFixed\(1\)/);
 });
 test('README ve yöntem dokümanı tam hassasiyet ile gösterim hassasiyetini ayırır',()=>{
  assert.match(rd('README.md'),/DBH'yi \*\*1 ondalık basamakla\*\* gösterir/);
  assert.match(rd('docs/methods.md'),/28,647889… → 28,6 cm/);
  assert.match(rd('en/methods/index.html'),/DBH is displayed to one decimal place/);
 });
});

describe('Kayıtlarım kademeli görünüm',()=>{
 test('eski düz recTable yerine proje bazlı disclosure kullanılır',()=>{
  const sh=rd('partials/shell.html'),d=rd('src/services/dash.js'),css=rd('css/style.css');
  assert.match(sh,/id="recGroups"/);
  assert.ok(!/id="recTable"/.test(sh));
  assert.match(d,/new Map\(\)/);
  assert.match(d,/dgRecordProjectGroup/);
  assert.match(d,/<details class="record-project"/);
  assert.match(css,/\.record-project>summary/);
  assert.match(css,/\.record-metrics/);
 });
 test('kayıt kartı ham çevreyi ve türetilmiş DBHyi birlikte gösterir',()=>{
  const d=rd('src/services/dash.js');
  assert.match(d,/>Çevre<\/span>/);
  assert.match(d,/>DBH<\/span>/);
  assert.match(d,/girth_cm/);
  assert.match(d,/dbh_cm/);
 });
});

test('çevrimdışı senkronizasyon ham çevreyi kaybetmez',()=>{
 assert.match(rd('src/services/offline.js'),/"girth_cm","dbh_cm"/);
});


describe('Dışa Aktar tema standardı',()=>{
 test('dosya, veri talebi ve QGIS rehberi açılır/kapanır ana tema panelleridir',()=>{
  const sh=rd('partials/shell.html'),css=rd('css/style.css');
  assert.match(sh,/class="export-heading"/);
  assert.equal((sh.match(/<details class="export-panel"/g)||[]).length,3);
  assert.match(sh,/Standart CSV/); assert.match(sh,/GeoJSON/); assert.match(sh,/QGIS CSV/);
  assert.match(sh,/Yöneticiden veri talep et/); assert.match(sh,/QGIS fotoğraf aktarım rehberi/);
  assert.match(css,/\.export-panel>summary/); assert.match(css,/\.export-format-grid/);
 });
 test('mevcut dışa aktarım işlevleri korunur; tekrar eden yöntem metni arayüzde gösterilmez',()=>{
  const sh=rd('partials/shell.html');
  for(const fn of ['exportCSV()','previewCSV()','exportGeo()','previewGeo()','exportQgis()','sendDataRequest()']) assert.ok(sh.includes(fn),fn+' korunmalı');
  assert.ok(!sh.includes('C → DBH = C/π · DBH 0,1 cm'));
  assert.ok(!sh.includes('Ölçüm protokolü korunur:'));
  assert.ok(!sh.includes('export-method-note'));
 });
});

describe('Mobil saha yardımı ve rapor künye UX',()=>{
 test('mobil ölçüm kimliği görünür; GPS doğruluk gürültüsü ana satırdan kaldırılmıştır',()=>{
  const sh=rd('partials/shell.html'),css=rd('css/style.css'),m=rd('src/services/measure.js');
  assert.match(sh,/measure-tag">Bir ağaç · bir kayıt/);
  assert.match(css,/#v-measure \.measure-tag\{display:inline-flex!important/);
  assert.ok(!sh.includes('id="gpsState"'));
  assert.ok(!sh.includes('doğruluk (m)'));
  assert.match(m,/btn\.innerHTML="🛰 GPS aktif"/);
 });
 test('çevre ve boy açıklamaları yalnız soru işareti yardımında bulunur',()=>{
  const sh=rd('partials/shell.html');
  assert.match(sh,/Göğüs çevresi[\s\S]{0,300}dg-inline-help[\s\S]{0,500}Mezurayı gövdenin etrafına/);
  assert.match(sh,/Ağaç boyu[\s\S]{0,300}dg-inline-help[\s\S]{0,500}yer seviyesinden tepe noktasına/);
 });
 test('rapor formu isteğe bağlı akademik alanları zorunlu yapmaz ve ? örnekleri verir',()=>{
  const a=rd('src/services/academic-profile.js');
  assert.match(a,/Danışman \(unvan, ad ve soyad\)/);
  assert.match(a,/Prof\. Dr\. Ad Soyad/);
  assert.match(a,/Üniversite, bölüm, program, danışman, ORCID, tarihler ve yöntem ayrıntıları isteğe bağlıdır/);
  assert.match(a,/DG_ACADEMIC_FIELDS\.filter\(\(\[k\]\)=>k!=='project_name'\)\.map\(\(\[k,l\]\)=>dgAcademicInput\(k,l,values\[k\]\)\)/);
 });
});
