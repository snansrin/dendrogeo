import {surfaceRuntimeModules} from '../scripts/lib/surface-runtime-modules.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/application/surface/prepare-sentinel-annual-evidence.js',
  'src/application/surface/find-sentinel-annual-scenes.js',
  'src/application/surface/read-sentinel-annual-scene-windows.js',
  'src/domain/surface/index-sentinel-annual-scene-cells.js',
  'src/application/surface/collect-sentinel-annual-evidence.js'
];
function setup(){const window={},context=vm.createContext({window,Set,Math,Number,Object,Promise,Error});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('annual evidence initialization preserves primary values and distinct dates',()=>{
  const window=setup(),accumulator={'0:0':{ndvis:[0.2],mndwis:[0.1],dates:new Set(['primary'])}};
  const result=window.DG_PREPARE_SENTINEL_ANNUAL_EVIDENCE.prepare({evidence:null,accumulator,year:2026,mode:'ytd',enabled:true,waterWindows:(year,mode)=>[{year,mode}]});
  assert.deepEqual(JSON.parse(JSON.stringify(result.windows)),[{year:2026,mode:'ytd'}]);
  assert.deepEqual(Array.from(result.evidence['0:0'].ndvi),[0.2]);assert.deepEqual(Array.from(result.evidence['0:0'].dates),['primary']);
  assert.notStrictEqual(result.evidence['0:0'],accumulator['0:0']);
  const disabled=window.DG_PREPARE_SENTINEL_ANNUAL_EVIDENCE.prepare({evidence:null,accumulator,year:2026,mode:'latest',enabled:false,waterWindows:()=>{throw Error('disabled scan must not select windows');}});
  assert.equal(disabled.enabled,false);assert.deepEqual(JSON.parse(JSON.stringify(disabled.windows)),[]);assert.deepEqual(Array.from(disabled.evidence['0:0'].ndvi),[0.2]);
});

test('annual scene finder preserves window order and absorbs failed date windows',async()=>{
  const window=setup(),events=[];
  const scenes=await window.DG_FIND_SENTINEL_ANNUAL_SCENES.find({windows:[{start:'a',end:'b',max:2,label:'spring'},{start:'c',end:'d',max:3,label:'autumn'}],bbox:{id:1},findRange:async(bbox,start,end,max)=>{events.push([bbox.id,start,end,max]);if(start==='a')throw Error('offline');return[{id:'scene'}];}});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[[1,'a','b',2],[1,'c','d',3]]);
  assert.deepEqual(JSON.parse(JSON.stringify(scenes.map(entry=>[entry.window.label,entry.scene.id]))),[['autumn','scene']]);
});

test('annual band reader keeps asset order, mask-first reads and missing-asset skip',async()=>{
  const window=setup(),events=[],images={};
  const result=await window.DG_READ_SENTINEL_ANNUAL_SCENE_WINDOWS.read({scene:{id:'s'},token:'t',bbox:{id:2},loadBands:{load:async options=>{events.push(['load',...options.bands,options.missing]);return images;}},readBands:{read:async options=>{events.push(['read',...options.bands,options.bbox.id]);return options.bands;}},signHref:()=>{},openRaster:()=>{},readBand:()=>{}});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['load','B03','B04','B08','B11','SCL','skip'],['read','SCL','B03','B04','B08','B11',2]]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),['SCL','B03','B04','B08','B11']);
  assert.equal(await window.DG_READ_SENTINEL_ANNUAL_SCENE_WINDOWS.read({scene:{},token:'',bbox:{},loadBands:{load:async()=>null},readBands:{},signHref:()=>{},openRaster:()=>{},readBand:()=>{}}),null);
});

test('annual cell indices use every band native CRS and raster window',()=>{
  const window=setup(),cells=[{center:{lat:1,lon:2}}],bands=Object.fromEntries(['SCL','B03','B04','B08','B11'].map((name,index)=>[name,{epsg:32630+index,meta:{id:index},win:[index]}]));
  const result=window.DG_INDEX_SENTINEL_ANNUAL_SCENE_CELLS.build({cells,bands,project:(lat,lon,epsg)=>({x:lat,y:lon,epsg}),indexFor:(meta,win,x,y)=>meta.id+win[0]+x+y});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{SCL:[3],B03:[5],B04:[7],B08:[9],B11:[11]});
});

test('annual collector applies SCL, nodata and distinct-day gates before seasonal maxima',()=>{
  const window=setup(),cells=[{row:0,col:0},{row:0,col:1}],reads={SCL:{values:[4,9]},B03:{values:[0.5,0.5]},B04:{values:[0.2,0.2]},B08:{values:[0.6,0.6]},B11:{values:[0.1,0.1]}};
  const indices=Object.fromEntries(['SCL','B03','B04','B08','B11'].map(name=>[name,[0,1]])),evidence={},waterMax={},vegMax={};
  const args={cells,reads,indices,validClasses:[4,5,6,7],item:{id:'scene'},datetime:'2026-04-20',reflectance:value=>value,evidence,waterMax,vegMax};
  assert.equal(window.DG_COLLECT_SENTINEL_ANNUAL_EVIDENCE.collect(args),1);
  assert.ok(Math.abs(evidence['0:0'].ndvi[0]-0.5)<1e-12);assert.equal(evidence['0:0'].mndwi[0],(0.5-0.1)/(0.5+0.1));
  assert.equal(waterMax['0:0'],evidence['0:0'].mndwi[0]);assert.equal(vegMax['0:0'],evidence['0:0'].ndvi[0]);assert.equal(evidence['0:1'],undefined);
  assert.equal(window.DG_COLLECT_SENTINEL_ANNUAL_EVIDENCE.collect(args),0);assert.equal(evidence['0:0'].dates.size,1);
});

test('five annual Sentinel-2 modules load before lc-s2 and are precached',()=>{
  const loader=read('src/utils/lazylibs.js'),worker=read('sw.js'),service=loader.indexOf('"src/services/lc-s2.js"');
  for(const path of modules){const position=loader.indexOf('"'+path+'"');assert.ok(position>=0&&position<service,`${path} load order`);assert.ok(worker.includes("'/"+path+"'"),`${path} precache`);assert.ok(read('scripts/val-qa.mjs').includes('surfaceRuntimeModules(')&&surfaceRuntimeModules(read).includes(path),`${path} live QA load order`);}
});
