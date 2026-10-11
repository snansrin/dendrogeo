import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportMapPresentation} from '../scripts/lib/report-map-presentation.mjs';

const render=createReportMapPresentation({esc:v=>String(v).replaceAll('<','&lt;')});
const base={L:null,P:{name:'<Park'},id:'DGR-2026-0042',epsg:null};

test('missing result omits the image while raster captions preserve provenance',()=>{
  assert.equal(render(base),'<p>Bu sürümde harita üretilmemiştir.</p>');
  const html=render({...base,L:{source:'<Raster'}});
  assert.match(html,/src="harita.png"/);
  assert.match(html,/&lt;Park/);
  assert.match(html,/&lt;Raster/);
  assert.match(html,/kesintisiz hücre çıktısından birebir ölçekli/);
  assert.match(html,/projeksiyonu \(—\)/);
  assert.match(html,/DGR-2026-0042/);
  assert.match(html,/Çizelge 2'de ve data.json/);
});

test('reviewed map captions distinguish accepted geometry from display generalization',()=>{
  const reviewed=render({...base,L:{source:'Raster',review:{}},epsg:'EPSG:32636'});
  assert.match(reviewed,/kabul edilmiş kayıt geometrilerinden/);
  assert.doesNotMatch(reviewed,/görsel genelleştirme/);
  assert.match(reviewed,/EPSG:32636/);
  const display=render({...base,L:{source:'Raster',review:{displayFeatures:[]}}});
  assert.match(display,/ortak kenarları koruyan görsel genelleştirme/);
  assert.match(display,/Alanlar kesin kabul geometrisinden hesaplanır/);
  assert.doesNotMatch(display,/kesintisiz hücre çıktısından/);
});
