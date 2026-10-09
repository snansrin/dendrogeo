import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadApp} from '../scripts/test-harness.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('karo sonuç birleştirme modülü alanları ve hücre/run sırasını deterministik toplar',()=>{
 const ctx={window:null,Object,Math,Number,Array};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/domain/surface/merge-tile-results.js'),ctx);
 const a={assignedAreaM2:12,classifiedAreaM2:10,maskedAreaM2:2,maskedCount:1,sourceCells:3,
   groupCounts:{green:2},groupAreas:{green:8},rawCounts:{10:2},rawAreas:{10:8},runs:[{id:'a'}],cells:[{id:'a'}]};
 const b={assignedAreaM2:8,classifiedAreaM2:8,maskedAreaM2:0,sourceCells:2,
   groupCounts:{green:1,hard:1},groupAreas:{green:3,hard:5},rawCounts:{10:1,50:1},rawAreas:{10:3,50:5},runs:[{id:'b'}],cells:[{id:'b'}]};
 ctx.parts=[a,b];
 const out=vm.runInContext('DG_SURFACE_TILE_MERGER.merge(parts)',ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(out)),{
  assignedAreaM2:20,classifiedAreaM2:18,maskedAreaM2:2,maskedCount:1,sourceCells:5,
  groupCounts:{green:3,hard:1},groupAreas:{green:11,hard:5},
  rawCounts:{10:3,50:1},rawAreas:{10:11,50:5},runs:[{id:'a'},{id:'b'}],cells:[{id:'a'},{id:'b'}]
 });
 assert.equal(a.assignedAreaM2,12,'girdi karoları değiştirilmemeli');
});

test('lc-engine eski dgLcMergeTileResults API adını domain modülüne yönlendirir',()=>{
 const ctx={window:null,Object,Math,Number,Array,Promise,AbortController,setTimeout,clearTimeout};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/domain/surface/merge-tile-results.js'),ctx);
 vm.runInContext(read('src/services/lc-engine.js'),ctx);
 const out=vm.runInContext('dgLcMergeTileResults([{assignedAreaM2:4,classifiedAreaM2:3,maskedAreaM2:1,sourceCells:2,groupCounts:{green:1},groupAreas:{green:3},rawCounts:{10:1},rawAreas:{10:3},runs:[],cells:[]}])',ctx);
 assert.equal(out.assignedAreaM2,4);
 assert.equal(out.groupAreas.green,3);
});

test('sonuç export adapterı CSV ve hücre GeoJSON sözleşmesini korur',()=>{
 const ctx={window:null,Object,Math,Number,Array,String,JSON};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/services/lc-config.js'),ctx);
 vm.runInContext(read('src/adapters/surface/result-exports.js'),ctx);
 ctx.result={assignedAreaM2:10000,groupCounts:{green:1,hard:1},groupAreas:{green:6000,hard:4000},
   rawCounts:{50:1,10:1},rawAreas:{50:4000,10:6000},maskedCount:0,maskedAreaM2:0,
   cells:[{row:3,col:4,classCode:50,classKey:'hard',areaM2:123.45678,center:{lat:39.9,lon:32.8},
     quadWgs:[[32.7,39.8],[32.9,39.8],[32.9,40],[32.7,40]],source:'primary'}]};
 ctx.meta={year:2021,resolutionM:10,primaryLabel:'ESA, "2021"'};
 const csv=vm.runInContext('DG_SURFACE_RESULT_EXPORTS.classCsv(result,meta)',ctx);
 assert.match(csv,/^\uFEFFCLASS,GROUP,SOURCE_CELL_COUNT,AREA_HA,PERCENT_OF_ANALYSIS_AREA,YEAR,RESOLUTION_M,SOURCE\n/);
 assert.match(csv,/"Yeşil alan","green",1,0\.6000,60\.0000,2021,10,"ESA, ""2021"""/);
 const geojson=JSON.parse(JSON.stringify(vm.runInContext('DG_SURFACE_RESULT_EXPORTS.cellsGeoJson(result)',ctx)));
 assert.equal(geojson.type,'FeatureCollection');
 assert.equal(geojson.features[0].properties.class_name,'Yapılı');
 assert.deepEqual(geojson.features[0].geometry.coordinates[0][0],geojson.features[0].geometry.coordinates[0].at(-1));
 assert.equal(geojson.features[0].properties.intersection_area_m2,123.4568);
});

test('kaynak analizi adapterı yinelenen karoyu bir kez işler ve kanıt kimliklerini korur',async()=>{
 const ctx={window:null,Object,Math,Number,Array,Promise,Set,AbortController,setTimeout,clearTimeout};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/application/surface/analyze-source.js'),ctx);
 const seen=[];
 ctx.ports={
  maxTiles:4,timeoutMs:1000,
  findTiles:async()=>[{id:'a',properties:{}},{id:'a',properties:{}},{id:'b',properties:{}}],
  getSas:async()=> 'token',
  getDataAsset:item=>({href:'https://data.test/'+item.id}),
  signedHref:(href,token)=>{assert.equal(token,'token');return href+'?signed';},
  processTile:async(item,href,geometry,source)=>{seen.push(item.id);return{assignedAreaM2:item.id==='a'?1:2};},
  mergeTileResults:parts=>({assignedAreaM2:parts.reduce((sum,part)=>sum+part.assignedAreaM2,0)})
 };
 const output=await vm.runInContext('DG_SURFACE_SOURCE_ANALYSIS.run({collection:"c",label:"Primary",year:2021},{},[],ports)',ctx);
 assert.deepEqual(seen,['a','b']);
 assert.equal(output.result.assignedAreaM2,3);
 assert.deepEqual(Array.from(output.items),['a','a','b']);
});

test('sınıf karar modülü kaynak kodu ve nodata politikasını tek API ile sunar',()=>{
 const ctx={window:null,Object,Math,Number,Array};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/services/lc-config.js'),ctx);
 vm.runInContext(read('src/domain/surface/classify-landcover-code.js'),ctx);
 assert.equal(vm.runInContext('DG_SURFACE_CLASSIFICATION.groupForCode(50,{key:"primary"})',ctx),'hard');
 assert.equal(vm.runInContext('DG_SURFACE_CLASSIFICATION.groupForCode(7,{key:"cross"})',ctx),'hard');
 assert.equal(vm.runInContext('DG_SURFACE_CLASSIFICATION.isMasked(0,{key:"primary"})',ctx),true);
 assert.equal(vm.runInContext('DG_SURFACE_CLASSIFICATION.isMasked(10,{key:"primary"})',ctx),false);
 assert.equal(vm.runInContext('DG_SURFACE_CLASSIFICATION.isMasked(10,{key:"cross"})',ctx),true);
});

test('tek karo raster adapterı 4326 rasterdaki gerçek kesişimleri ve ham kodları korur',async()=>{
 const ctx=loadApp({sadece:[
  'src/config/constants.js','src/services/lc-config.js','src/domain/surface/classify-landcover-code.js',
  'src/services/lc-geo.js','src/services/lc-stac.js','src/domain/surface/merge-tile-results.js',
  'src/adapters/surface/result-exports.js','src/application/surface/analyze-source.js'
 ]});
 const image={
  getGeoKeys:()=>({}),getBoundingBox:()=>[32.85,39.92,32.87,39.94],getWidth:()=>2,getHeight:()=>2,
  readRasters:async()=>new Uint16Array([10,50,80,0])
 };
 ctx.dgLcOpenRaster=async()=>({getImage:async()=>image});
 vm.runInContext(read('src/adapters/surface/process-landcover-tile.js'),ctx);
 vm.runInContext(read('src/services/lc-engine.js'),ctx);
 ctx.geometry={outer:[[[39.92,32.85],[39.92,32.87],[39.94,32.87],[39.94,32.85]]],holes:[]};
 const tile=await vm.runInContext('dgLcProcessTile({id:"fixture",properties:{}},"fixture.tif",geometry,DG_LC_SOURCES.primary)',ctx);
 assert.equal(tile.sourceCells,4);
 assert.equal(tile.groupCounts.green,1);
 assert.equal(tile.groupCounts.hard,1);
 assert.equal(tile.groupCounts.water,1);
 assert.equal(tile.maskedCount,1);
 assert.equal(tile.rawCounts[10],1);
 assert.equal(tile.rawCounts[50],1);
 assert.equal(tile.rawCounts[80],1);
 assert.equal(tile.cells.length,3);
 assert.ok(tile.cells.every(cell=>cell.areaM2>0&&cell.quadWgs.length===4));
});

test('eski motor kilidi yürürlükten kalktı; kurtarma snapshotı salt arşiv olarak kaldı',()=>{
 const record=JSON.parse(read('docs/surface-engine-lock.json'));
 const pkg=JSON.parse(read('package.json'));
 const ci=read('.github/workflows/ci.yml');
 assert.equal(record.status,'RETIRED_BY_USER');
 assert.equal(record.policy,'ARCHIVE_ONLY_NO_ENFORCEMENT');
 assert.equal(record.recovery_branch,'recovery/analysis-engine-20261009');
 assert.ok(!pkg.scripts.check.includes('check:surface-lock'));
 assert.ok(!ci.includes('check-surface-lock.mjs'));
 assert.ok(read('sw.js').includes('/src/adapters/surface/result-exports.js'));
 assert.ok(read('sw.js').includes('/src/adapters/surface/process-landcover-tile.js'));
});

test('canlı park QA komut satırı analiz modüllerinin tamamını iki VM bağlamında yükler',()=>{
 const qa=read('scripts/lulc-qa.mjs');
 for(const module of [
  'src/domain/surface/classify-landcover-code.js','src/domain/surface/compare-source-class-areas.js',
  'src/domain/surface/merge-tile-results.js','src/adapters/surface/result-exports.js',
  'src/application/surface/analyze-source.js','src/adapters/surface/process-landcover-tile.js',
  'src/domain/surface/patch-geometry.js','src/services/lc-engine.js'
 ])assert.equal(qa.split(module).length-1,2,'QA bağlamında eksik/tekrarlı modül: '+module);
 assert.match(qa,/--fixture goksu/);
 assert.match(qa,/test\/fixtures\/goksu-park\.json/);
});
