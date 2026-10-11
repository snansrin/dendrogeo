import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportSourcesPresentation} from '../scripts/lib/report-sources-presentation.mjs';

const render=createReportSourcesPresentation({esc:v=>String(v).replaceAll('<','&lt;'),fmtDateTr:String});
const base={L:null,dataset:'Raster <source',dataYear:2021,t:{n:3}};

test('raster and field disclosures preserve source escaping and sample scope',()=>{
  const html=render(base);
  assert.match(html,/Raster &lt;source/);
  assert.match(html,/veri dönemi 2021/);
  assert.match(html,/OSM verisi raster sınıflandırmanın yerine geçmez/);
  assert.match(html,/3 adet DendroGeo saha ölçümü/);
  assert.match(html,/tam sayım veya olasılıklı örnekleme/);
  assert.doesNotMatch(html,/3.4 Çapraz doğrulama/);
});

test('accepted and reviewed sources preserve archive limitations and used-scene filtering',()=>{
  const accepted=render({...base,L:{accepted:true,accepted_at:'2026-10-11'}});
  assert.match(accepted,/kayıt sürümü —/);
  assert.match(accepted,/nesne geometrileri ve uydu sahne ayrıntıları kayıtlı değildir/);
  const reviewed=render({...base,L:{review:{acceptedAt:'2026-10-11',scenes:[{usedCells:2,datetime:'used-scene'},{usedCells:0,datetime:'unused-scene'}]}}});
  assert.match(reviewed,/used-scene/);
  assert.doesNotMatch(reviewed,/unused-scene/);
  assert.match(reviewed,/surface.geojson/);
  assert.match(render({...base,L:{review:{scenes:[]}}}),/uydu taraması yok/);
});

test('cross-validation failure is disclosed with escaped source and error',()=>{
  const html=render({...base,L:{cross:'<comparison',crossError:'<failure'}});
  assert.match(html,/&lt;comparison/);
  assert.match(html,/çapraz karşılaştırma tamamlanamadı: &lt;failure/);
});
