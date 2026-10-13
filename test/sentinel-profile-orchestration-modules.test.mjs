import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadApp} from '../scripts/test-harness.mjs';

const run=(context,source)=>vm.runInContext(source,context);
const modules=[
  'src/domain/surface/build-sentinel-profile-bbox.js',
  'src/domain/surface/select-sentinel-profile-epsg.js',
  'src/application/surface/prepare-sentinel-profile-input.js',
  'src/application/surface/run-sentinel-scene-observation-pass.js',
  'src/application/surface/run-sentinel-annual-observation-pass.js'
];

test('profile input keeps the expanded cell window and requested or inferred EPSG',()=>{
  const app=loadApp(),cells=[{center:{lat:39,lon:32}},{center:{lat:40,lon:33}}];
  Object.assign(app,{cells,epsgFor:(lat,lon)=>lat===39&&lon===32?32636:0});
  const prepared=run(app,'window.DG_PREPARE_SENTINEL_PROFILE_INPUT.prepare({cells,requestedEpsg:null},{buildBbox:window.DG_BUILD_SENTINEL_PROFILE_BBOX.build,selectEpsg:window.DG_SELECT_SENTINEL_PROFILE_EPSG.select,epsgForLatLon:epsgFor})');
  assert.deepEqual(Object.keys(prepared.bbox).sort(),['maxLat','maxLon','minLat','minLon']);
  assert.equal(prepared.bbox.minLat,38.9998);assert.equal(prepared.bbox.maxLat,40.0002);
  assert.equal(prepared.bbox.minLon,31.9997);assert.equal(prepared.bbox.maxLon,33.0003);
  assert.equal(prepared.epsg,32636);assert.equal(prepared.cells,cells);
  assert.equal(run(app,'window.DG_SELECT_SENTINEL_PROFILE_EPSG.select(cells,32635,epsgFor)'),32635);
  assert.throws(()=>run(app,'window.DG_PREPARE_SENTINEL_PROFILE_INPUT.prepare({cells:[],requestedEpsg:null},{buildBbox:window.DG_BUILD_SENTINEL_PROFILE_BBOX.build,selectEpsg:window.DG_SELECT_SENTINEL_PROFILE_EPSG.select,epsgForLatLon:epsgFor})'),/hücre listesi yok/);
});

test('scene observation pass preserves band order, used-cell counts, and per-scene failures',async()=>{
  const app=loadApp(),cells=[{id:'0:0'}],scenes=[{id:'ok',item:{id:'ok'},datetime:'2026-04-01'},{id:'bad',item:{id:'bad'},datetime:'2026-04-02'}],skipped=[],calls=[],accumulator={};
  Object.assign(app,{cells,scenes,skipped,accumulator});
  app.loadBands={load:async({scene})=>{if(scene.id==='bad')throw Error('offline');return{scene};}};
  app.readWindows={read:async({images,bands})=>{calls.push(['read',images.scene.id,bands]);return{SCL:{id:'scl'}};}};
  app.indexCells={build:({cells,bands})=>{calls.push(['index',cells.length,bands.SCL.id]);return[0];}};
  app.collect=(options)=>{calls.push(['collect',options.item.id,options.validClasses.length]);return 1;};
  app.warn=(...args)=>calls.push(['warn',...args]);app.indexFor=()=>{};app.project=()=>{};app.reflectance=()=>{};
  await run(app,'window.DG_RUN_SENTINEL_SCENE_OBSERVATION_PASS.run({scenes,cells,token:"token",bbox:{},bands:["B03"],validClasses:[2,4],accumulator,skipped},{loadBands,readWindows,indexCells,collect,project,indexFor,reflectance,signHref:()=>"signed",openRaster:async()=>{},readBand:async()=>{},warn})');
  assert.equal(scenes[0].usedCells,1);assert.equal(scenes[1].usedCells,undefined);
  assert.equal(skipped[0].reason,'offline');
  assert.equal(calls[0][2].join(','),'SCL,B03,B04,B08,B11');
  assert.ok(calls.some(call=>call[0]==='collect'&&call[1]==='ok'));
  assert.ok(calls.some(call=>call[0]==='warn'&&call[1].includes('Sentinel-2 sahnesi atlandı')));
});

test('annual observation pass records evidence scenes, skips empty reads, and isolates failures',async()=>{
  const app=loadApp(),sceneA={id:'empty',item:{id:'empty'},datetime:'2026-03-01'},sceneB={id:'ok',item:{id:'ok'},datetime:'2026-04-01'},sceneC={id:'bad',item:{id:'bad'},datetime:'2026-10-01'},entries=[{window:{label:'spring'},scene:sceneA},{window:{label:'spring'},scene:sceneB},{window:{label:'autumn'},scene:sceneC}],cells=[{id:'0:0'}],waterScenes=[],warnings=[];
  Object.assign(app,{entries,cells,waterScenes});
  app.loadBands={};app.readWindows={readBand:async()=>{}};
  app.readAnnualWindows={read:async({scene})=>{if(scene.id==='empty')return null;if(scene.id==='bad')throw Error('asset unavailable');return{SCL:{id:'scl'}};}};
  app.indexCells={build:()=>[0]};app.collect=()=>2;app.project=()=>{};app.indexFor=()=>{};app.reflectance=()=>{};app.warn=(...args)=>warnings.push(args);
  await run(app,'window.DG_RUN_SENTINEL_ANNUAL_OBSERVATION_PASS.run({entries,cells,token:"token",bbox:{},validClasses:[2,4],evidence:{},waterMax:{},vegMax:{},waterScenes},{loadBands,readWindows,readAnnualWindows,indexCells,collect,project,indexFor,reflectance,signHref:()=>"signed",openRaster:async()=>{},readBand:async()=>{},warn})');
  assert.equal(waterScenes.length,1);assert.equal(waterScenes[0].id,'ok');assert.equal(waterScenes[0].window,'spring');assert.equal(waterScenes[0].usedCells,2);
  assert.equal(warnings.length,1);assert.match(warnings[0][0],/su sahnesi atlandı/);
});

test('five Sentinel profile modules load before lc-s2 and are precached',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const service=lazy.indexOf('"src/services/lc-s2.js"');
  for(const path of modules){assert.ok(lazy.indexOf('"'+path+'"')>=0&&lazy.indexOf('"'+path+'"')<service,path);assert.ok(sw.includes("'/"+path+"'"),path);}
});
