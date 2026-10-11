import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportOverviewPresentation} from '../scripts/lib/report-overview-presentation.mjs';

const render=createReportOverviewPresentation({esc:v=>String(v).replaceAll('<','&lt;'),trNum:(v,d)=>Number(v).toFixed(d)});
const base={P:{name:'<Park',city:'Ankara',country:'Türkiye'},t:{n:3,per_ha_kg:null},ciTxt:'1 t [interval]',L:null,dataset:'<Source',srcTxt:'OSM <code>way/1</code>',parkHa:1,GJ:null,knotted:false,knotN:0,snap:{period:{from:'2026-10-01T00:00:00Z',to:'2026-10-11T00:00:00Z'},geofence:{outside_rows:0}}};

test('overview preserves sample scope, missing density and safe site values',()=>{
  const html=render(base);
  assert.match(html,/&lt;Park/);
  assert.match(html,/<b>1 t \[interval\]<\/b>/);
  assert.match(html,/oranı — değerindedir/);
  assert.match(html,/parkın toplam karbon stok yoğunluğu tahmini değildir/);
  assert.match(html,/OSM <code>way\/1<\/code>/);
  assert.match(html,/2026-10-01 – 2026-10-11/);
  assert.match(html,/kayıtların tamamı poligon içinde/);
  assert.doesNotMatch(html,/Yüzey örtüsü verisi|kendini kesen segment çifti/);
});

test('surface, geometry and partial geofence notes preserve existing conditions and counts',()=>{
  const html=render({...base,t:{n:3,per_ha_kg:2500},L:{},GJ:{ring_points:5,ring_area_m2:20000},knotted:true,knotN:2,snap:{...base.snap,geofence:{outside_rows:1,verified_rows:2,total:3}}});
  assert.match(html,/2.500 t\/ha/);
  assert.match(html,/&lt;Source/);
  assert.match(html,/dikdörtgen \(5 nokta; 2.00 ha\)/);
  assert.match(html,/2 kendini kesen segment çifti/);
  assert.match(html,/2\/3 adedi poligon içinde, 1 adedi poligon dışında/);
});
