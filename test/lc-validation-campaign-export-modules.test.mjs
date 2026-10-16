import {surfaceRuntimeModules} from '../scripts/lib/surface-runtime-modules.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from '../scripts/test-harness.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/surface/validation-spectral-rules.js',
  'src/domain/surface/build-validation-campaign-csv-rows.js',
  'src/application/surface/serialize-validation-campaign-csv.js',
  'src/application/surface/serialize-validation-campaign-json.js',
  'src/domain/surface/apply-validation-campaign-corrections.js',
  'src/domain/surface/build-validation-corrected-geojson.js'
];
const same=(actual,expected)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected));

test('campaign export and adjudication modules preserve the compatibility API',()=>{
  const legacy=loadApp({sadece:[...modules,'src/application/surface/serialize-validation-campaign.js','src/services/lc-validate.js']}).DG_LC_VALIDATE;
  const current=loadApp({sadece:[...modules,'src/application/surface/serialize-validation-campaign.js','src/services/lc-validate.js']}).DG_LC_VALIDATE;
  const campaign={id:'c-1',parkName:'Park "A"',parkId:'p1',seed:42,engineVersion:'3.0',createdAt:'2026-10-13',samples:[{id:'S001',lat:41.1,lon:29.1,row:2,col:3,mapClass:'green',refClass:'water',areaM2:100}],spectral:{cells:{'2:3':{ndvi:.4567,mndwi:.1,ndbi:-.2,mndwiMaxYear:.6,ndviMax:.7,predict:'water'}}},metrics:{n:1,nAmbiguous:0,oa:.8,oaCi95:.1,kappa:.5,perClass:{green:{n:1,correct:0,ua:0,uaCi95:.1,pa:.2,adjustedAreaHa:1,adjustedCi95Ha:.3,weight:.4}}},gate:{state:'REVIEW',label:'review',reasons:['verify']},corrections:{'2:3':{from:'green',to:'water',ts:'today'}},rasterAreas:{green:100,water:0},correctedAreas:{green:0,water:100}};
  const classes=['green','water','hard','bare'];
  assert.equal(current.csv(campaign),legacy.csv(campaign));
  assert.equal(current.json(campaign),legacy.json(campaign));
  const cells=[{row:2,col:3,classKey:'green',areaM2:100,center:{lat:41.1,lon:29.1},quadWgs:[[29,41],[30,41],[30,42],[29,42]]}];
  same(current.applyCorrections(campaign.rasterAreas,cells,campaign.corrections),legacy.applyCorrections(campaign.rasterAreas,cells,campaign.corrections));
  same(current.correctedGeoJson(cells,campaign.corrections,campaign.spectral.cells),legacy.correctedGeoJson(cells,campaign.corrections,campaign.spectral.cells));
  const api=loadApp({sadece:modules});
  const rows=api.DG_BUILD_VALIDATION_CAMPAIGN_CSV_ROWS.build(campaign,{version:'1.1.0',classes});
  assert.equal(api.DG_SERIALIZE_VALIDATION_CAMPAIGN_CSV.serialize(rows),current.csv(campaign));
  assert.equal(api.DG_SERIALIZE_VALIDATION_CAMPAIGN_JSON.serialize(campaign,'1.1.0'),current.json(campaign));
});

test('campaign export modules load before the service in lazy, live-QA and offline chains',()=>{
  const loader=read('src/utils/lazylibs.js'),worker=read('sw.js'),qa=read('scripts/val-qa.mjs');
  const service='src/services/lc-validate.js',serviceIndex=loader.indexOf('"'+service+'"');
  for(const path of modules){
    assert.ok(loader.indexOf('"'+path+'"')>=0&&loader.indexOf('"'+path+'"')<serviceIndex,path+' loader order');
    assert.ok(worker.includes("'/"+path+"'"),path+' offline precache');
    assert.ok(qa.includes('surfaceRuntimeModules(')&&surfaceRuntimeModules(read).includes(path),path+' live QA loader');
  }
});
