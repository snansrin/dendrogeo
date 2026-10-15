import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from '../scripts/test-harness.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/surface/validation-sampling.js',
  'src/domain/surface/build-validation-confusion-matrix.js',
  'src/domain/surface/build-validation-stratum-weights.js',
  'src/domain/surface/calculate-validation-class-proportions.js',
  'src/domain/surface/calculate-validation-area-estimates.js',
  'src/domain/surface/calculate-validation-class-accuracy.js',
  'src/domain/surface/validation-accuracy-metrics.js',
  'src/domain/surface/validation-spectral-rules.js',
  'src/application/surface/build-validation-agreement.js',
  'src/domain/surface/build-validation-campaign-csv-rows.js',
  'src/application/surface/serialize-validation-campaign-csv.js',
  'src/application/surface/serialize-validation-campaign-json.js',
  'src/domain/surface/apply-validation-campaign-corrections.js',
  'src/domain/surface/build-validation-corrected-geojson.js',
  'src/application/surface/serialize-validation-campaign.js',
  'src/adapters/surface/validation-campaign-store.js',
  'src/application/surface/validation-campaign-archive.js'
];
const app=loadApp({sadece:[...modules,'src/services/lc-validate.js']}),api=app.DG_LC_VALIDATE;
const same=(actual,expected)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected));

test('legacy DG_LC_VALIDATE API delegates to the single domain/application owners',()=>{
  const cells=['green','water','hard','bare'].flatMap((classKey,index)=>Array.from({length:4},(_,n)=>({
    classKey,classCode:index+1,row:index,col:n,areaM2:900,
    center:{lat:41+index/100,lon:29+n/100},
    quadWgs:[[29,41],[29.01,41],[29.01,41.01],[29,41.01]]
  })));
  const opts={seed:42,perStratum:3},sample=api.stratifiedSample(cells,opts);
  same(sample,app.DG_VALIDATION_SAMPLING.stratified(cells,opts,{defaults:api.defaults,classes:api.classes}));
  same(api.spatialSample(cells,{seed:21,count:7}),app.DG_VALIDATION_SAMPLING.spatial(cells,{seed:21,count:7},{defaults:api.defaults}));
  const labels=[{mapClass:'green',refClass:'green'},{mapClass:'green',refClass:'water'},{mapClass:'water',refClass:'water'},{mapClass:'hard',refClass:'ambiguous'}];
  const confusion=api.confusion(labels),weights=api.weights({green:60,water:30,hard:10},100);
  same(confusion,app.DG_VALIDATION_ACCURACY_METRICS.confusion(labels,api.classes));
  same(api.metrics(confusion,weights,10000),app.DG_VALIDATION_ACCURACY_METRICS.metrics(confusion,weights,10000,api.classes));
  assert.equal(api.spectralPredict({obs:4,ndvi:.12,mndwi:.7,ndbi:0}),'water');
  const agreement=api.agreement(cells,{});
  same(agreement,app.DG_BUILD_VALIDATION_AGREEMENT.agreement(cells,{},undefined,{defaults:api.defaults,classes:api.classes,predict:api.spectralPredict}));
  const campaign={id:'c1',parkName:'Park',parkId:'p1',seed:42,createdAt:'2026-10-13',samples:sample,metrics:{...api.metrics(confusion,weights,10000),oaCi95:.1},gate:{state:'INCELEME',label:'🟡 İNCELEME',reasons:['test']},corrections:{'0:0':{from:'green',to:'water',ts:'now'}},rasterAreas:{green:900,water:0,hard:0,bare:0}};
  same(api.csv(campaign),app.DG_SERIALIZE_VALIDATION_CAMPAIGN.csv(campaign,{version:api.version,classes:api.classes}));
  same(JSON.parse(api.json(campaign)),JSON.parse(app.DG_SERIALIZE_VALIDATION_CAMPAIGN.campaignJson(campaign,api.version)));
});

test('validation modules load before the service and remain in the offline cache',()=>{
  const chain=read('src/utils/lazylibs.js'),worker=read('sw.js'),serviceIndex=chain.indexOf('"src/services/lc-validate.js"');
  for(const path of modules){
    assert.ok(chain.indexOf('"'+path+'"')>=0&&chain.indexOf('"'+path+'"')<serviceIndex,path+' must load before the facade');
    assert.ok(worker.includes("'/"+path+"'"),path+' must be offline cached');
  }
});
