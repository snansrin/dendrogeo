import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportResultsPresentation} from '../scripts/lib/report-results-presentation.mjs';

const render=createReportResultsPresentation({esc:v=>String(v).replaceAll('<','&lt;'),trNum:(v,d)=>Number(v).toFixed(d),sw:v=>v});
const base={spRows:'<tr>species</tr>',bars:'<div>bars</div>',ciTxt:'1 t [interval]',snap:{mc:{N:1000,SEED:42,MODEL_CV:0.22}},govdeAralikTxt:null,L:null,parkHa:1,covHa:null,clsHa:null,diffHa:null,deltaPct:null};

test('inventory-only results preserve supplied summaries and uncertainty scope',()=>{
  const html=render(base);
  assert.match(html,/<tr>species<\/tr>/);
  assert.match(html,/<div>bars<\/div>/);
  assert.match(html,/n=1000, tohum=42, model CV=%22/);
  assert.match(html,/örnekleme belirsizliğini kapsamaz/);
  assert.match(html,/DBH = çevre \/ π/);
  assert.doesNotMatch(html,/5.2 Arazi örtüsü|Türetilmiş DBH aralığı:/);
});

test('surface tables preserve class formatting, missing values and diameter disclosure',()=>{
  const html=render({...base,govdeAralikTxt:'10–20 cm',L:{classes:[{label:'<Surface',ha:0.5,pct:50}]}});
  assert.match(html,/&lt;Surface/);
  assert.match(html,/<td>0.50<\/td><td>%50.0<\/td>/);
  assert.match(html,/Türetilmiş DBH aralığı:<\/b> 10–20 cm/);
  assert.match(html,/raster kapsama\)<\/td><td>—/);
  assert.match(html,/Park geometrisi alanı<\/td><td>1.00 ha/);
});
