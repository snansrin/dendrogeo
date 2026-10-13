import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/surface/load-sentinel-scene-bands.js',
  'src/application/surface/read-sentinel-scene-windows.js',
  'src/domain/surface/index-sentinel-scene-cells.js',
  'src/application/surface/collect-sentinel-scene-observations.js',
  'src/domain/surface/merge-sentinel-annual-evidence.js'
];
function setup(){const window={},context=vm.createContext({window,Set,Math,Number,Object,Promise,Error});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('scene band loader preserves order, signing, and missing-asset handling',async()=>{
  const window=setup(),events=[],scene={item:{assets:{B03:{href:'green'},B04:{href:'red'},SCL:{href:'mask'}}}};
  const images=await window.DG_LOAD_SENTINEL_SCENE_BANDS.load({scene,token:'sig',bands:['B03','B04'],signHref:(href,token)=>`${href}?${token}`,openRaster:async href=>{events.push(href);return{getImage:async()=>({href})};}});
  assert.deepEqual(Object.keys(images),['B03','B04']);assert.deepEqual(events,['green?sig','red?sig']);
  assert.equal(await window.DG_LOAD_SENTINEL_SCENE_BANDS.load({scene,token:'',bands:['SCL','B11'],signHref:value=>value,openRaster:async()=>({getImage:async()=>({})}),missing:'skip'}),null);
  await assert.rejects(window.DG_LOAD_SENTINEL_SCENE_BANDS.load({scene,token:'',bands:['B11'],signHref:value=>value,openRaster:async()=>({getImage:async()=>({})})}),/B11 asset/);
});

test('scene windows read the SCL mask and spectral bands in caller order',async()=>{
  const window=setup(),events=[],images={SCL:{id:'mask'},B03:{id:'green'},B04:{id:'red'}};
  const result=await window.DG_READ_SENTINEL_SCENE_WINDOWS.read({images,bands:['SCL','B03','B04'],bbox:{minLat:1},readBand:async(image,bbox)=>{events.push([image.id,bbox.minLat]);return image.id;}});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['mask',1],['green',1],['red',1]]);assert.equal(result.SCL,'mask');
});

test("cell indices use each spectral band's own CRS and raster window",()=>{
  const window=setup(),calls=[],cells=[{center:{lat:1,lon:2}},{center:{lat:3,lon:4}}],bands={B03:{epsg:32635,meta:{id:3},win:[1]},SCL:{epsg:32636,meta:{id:4},win:[2]}};
  const indices=window.DG_INDEX_SENTINEL_SCENE_CELLS.build({cells,bands,project:(lat,lon,epsg)=>({x:lat,y:lon,epsg}),indexFor:(meta,win,x,y)=>{calls.push([meta.id,win[0],x,y]);return meta.id+x+y;}});
  assert.deepEqual(JSON.parse(JSON.stringify(indices)),{B03:[6,10],SCL:[7,11]});assert.deepEqual(JSON.parse(JSON.stringify(calls)),[[3,1,1,2],[3,1,3,4],[4,2,1,2],[4,2,3,4]]);
});

test('observation collector enforces SCL, nodata, and distinct-date evidence',()=>{
  const window=setup(),cells=[{row:0,col:0},{row:0,col:1}],accumulator={},bands=Object.fromEntries(['B03','B04','B08','B11'].map((name,index)=>[name,{values:[0.2+index*0.1,0.3+index*0.1]}]));
  const indices={SCL:[0,1],B03:[0,1],B04:[0,1],B08:[0,1],B11:[0,1]};
  const used=window.DG_COLLECT_SENTINEL_SCENE_OBSERVATIONS.collect({cells,scl:{values:[4,9]},bands,indices,validClasses:[4,5,6,7],item:{},datetime:'2026-10-13',reflectance:value=>value,accumulator});
  assert.equal(used,1);assert.deepEqual(Array.from(accumulator['0:0'].dates),['2026-10-13']);assert.equal(accumulator['0:1'],undefined);
  window.DG_COLLECT_SENTINEL_SCENE_OBSERVATIONS.collect({cells:[cells[0]],scl:{values:[4]},bands,indices:{...indices,SCL:[0],B03:[0],B04:[0],B08:[0],B11:[0]},validClasses:[4],item:{},datetime:'2026-10-13',reflectance:value=>value,accumulator});
  assert.equal(accumulator['0:0'].dates.size,1);assert.equal(accumulator['0:0'].b03.length,1);
});

test('annual evidence merge preserves yearly confirmed metrics and rounded maxima',()=>{
  const window=setup(),out={'1:2':{mndwiMax:0.37,ndviMax:0.61}},evidence={'1:2':{ndvi:[0.2,0.3,0.4],mndwi:[0.1,0.5],dates:new Set(['a','b','c'])}};
  const result=window.DG_MERGE_SENTINEL_ANNUAL_EVIDENCE.merge({out,evidence,waterMax:{'1:2':0.63},vegMax:{'1:2':0.7},confirmedExtreme:values=>values.length>1?Math.min(...values):null,vegetationSummary:value=>({ndviMedianYear:0.3})});
  assert.strictEqual(result,out);assert.deepEqual(JSON.parse(JSON.stringify(out['1:2'])),{mndwiMax:0.37,ndviMax:0.61,ndviConfirmedYear:0.2,mndwiConfirmedYear:0.1,ndviMedianYear:0.3,yearObs:3,mndwiMaxYear:0.63,ndviMaxYear:0.7});
});

test('five Sentinel-2 workflow modules load before the service and are precached',()=>{
  const loader=read('src/utils/lazylibs.js'),worker=read('sw.js'),service=loader.indexOf('"src/services/lc-s2.js"');
  for(const path of modules){const position=loader.indexOf('"'+path+'"');assert.ok(position>=0&&position<service,`${path} load order`);assert.ok(worker.includes("'/"+path+"'"),`${path} precache`);}
});
