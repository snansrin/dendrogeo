import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportEvaluationPresentation} from '../scripts/lib/report-evaluation-presentation.mjs';

const render=createReportEvaluationPresentation({
  esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),
  trNum:(value,d)=>Number(value).toFixed(d)
});

test('evaluation preserves surface order, escaped dominant label and carbon group shares',()=>{
  const classes=Object.freeze([
    Object.freeze({key:'building',label:'<Building>',pct:60}),
    Object.freeze({key:'green',label:'Green',pct:40})
  ]);
  const species=Object.freeze([Object.freeze({grp:'IBRELI',carbon_kg:25}),Object.freeze({grp:'YAPRAKLI',carbon_kg:75})]);
  const html=render({snap:{species},L:{classes},t:{n:2,carbon_kg:100,per_ha_kg:250},ciTxt:'interval'});
  assert.match(html,/yeşil alan %40.0; bina %60.0/);
  assert.match(html,/baskın sınıf %60.0 pay ile &lt;Building&gt;/);
  assert.match(html,/ibreli türlerde %25.0, yapraklı türlerde %75.0/);
  assert.match(html,/0.250 t\/ha/);
  assert.match(html,/ekstrapole edilmemelidir/);
  assert.match(html,/nedensel ilişki bu veri kapsamıyla test edilmemiştir/);
  assert.equal(classes[0].key,'building');
});

test('missing surface and area ratio omit invented values while retaining sample scope',()=>{
  const html=render({snap:{species:[]},L:null,t:{n:0,carbon_kg:0,per_ha_kg:null},ciTxt:'zero'});
  assert.doesNotMatch(html,/Arazi örtüsü sınıflandırmasına/);
  assert.match(html,/stokun tek grupta/);
  assert.match(html,/oranı — değerindedir/);
  assert.match(html,/Örneklem 0 ağaç ölçümüne/);
});
