import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
  'src/domain/surface/scale-area-preserving-patch-ring.js',
  'src/domain/surface/smooth-patch-ring.js',
  'src/domain/surface/build-patch-display-rings.js',
  'src/application/surface/build-surface-patch.js',
  'src/application/surface/detect-surface-patches.js'
];
const legacyFiles=['src/domain/surface/patch-geometry.js','src/domain/surface/group-patch-cells.js','src/domain/surface/measure-patch-components.js','src/domain/surface/query-green-patches.js','src/services/lc-patches.js'];
function context(){
  const ctx=vm.createContext({window:{}});
  for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return ctx;
}

test('real service composition matches the locked legacy output for a georeferenced cell',()=>{
  const cell={row:0,col:0,epsg:32636,classKey:'green',areaM2:100,center:{lat:40.001,lon:32.001},quadWgs:[[32,40],[32.001,40],[32.001,40.001],[32,40.001]]};
  const run=withModules=>{
    const ctx=vm.createContext({window:{},console:{warn(){}}});
    const sources=withModules?[...legacyFiles.slice(0,3),...files,...legacyFiles.slice(3)]:legacyFiles;
    for(const file of sources)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
    return JSON.parse(JSON.stringify(ctx.dgLcDetectPatches([cell],0.001)));
  };
  assert.deepEqual(run(true),run(false));
});

test('area preservation follows legacy factor bounds and defers centroid until scaling applies',()=>{
  const api=context().window.DG_SCALE_AREA_PRESERVING_PATCH_RING;
  const ring=[[0,0],[2,0]],center=[1,0];
  assert.deepEqual(Array.from(api.scale(ring,100,64,()=>center),point=>Array.from(point)),[[-0.25,0],[2.25,0]]);
  let centered=false;
  assert.equal(api.scale(ring,100,100,()=>{centered=true;return center;}),ring);
  assert.equal(centered,false);
  assert.equal(api.scale(ring,100,40,()=>{centered=true;return center;}),ring);
  assert.equal(centered,false);
  assert.equal(api.scale(ring,0,50,()=>center),ring);
});

test('single ring smoothing preserves the one-pass order and delegates scale only for valid areas',()=>{
  const api=context().window.DG_SMOOTH_SURFACE_PATCH_RING,calls=[];let areaCall=0;
  const output=api.smooth([[0,0],[2,0]],1,{
    smooth:(ring,iters)=>{calls.push(['smooth',iters]);return ring.map(([x,y])=>[x/2,y]);},
    area:ring=>{calls.push(['area',ring[0][0]]);return ++areaCall===1?4:2;},
    centroid:ring=>{calls.push(['centroid']);return[0,0];},
    scale:(ring,a,b,getCenter)=>{const center=getCenter();calls.push(['scale',a,b]);return ring.map(([x,y])=>[x*2+center[0],y+center[1]]);}
  });
  assert.deepEqual(Array.from(output,point=>Array.from(point)),[[0,0],[2,0]]);
  assert.deepEqual(calls,[['smooth',1],['area',0],['area',0],['centroid'],['scale',4,2]]);
});

test('patch build retains raw rings and component metrics when display construction throws',()=>{
  const api=context().window.DG_BUILD_SURFACE_PATCH,raw=[[[1,2],[3,4]]],warnings=[];
  const result=api.build({cells:[{classKey:'green'},{classKey:'green'}],areaM2:240,centroid:{lat:1,lon:2}}, {
    extractRings:()=>raw,
    buildDisplayRings:()=>{throw new Error('display failure');},
    warn:error=>warnings.push(error.message)
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{classKey:'green',areaM2:240,cells:2,centroid:{lat:1,lon:2},rings:[],ringsRaw:raw});
  assert.deepEqual(warnings,['display failure']);
});

test('detector keeps grouping, metric threshold, and patch order in a single use-case',()=>{
  const api=context().window.DG_SURFACE_PATCH_DETECTOR,calls=[];
  const items=[{id:'large'},{id:'small'}];
  const result=api.detect(['cell'],0.1,{
    groupCells:cells=>{calls.push(['group',cells.length]);return['components'];},
    summarizeComponents:(components,threshold)=>{calls.push(['measure',components[0],threshold]);return items;},
    buildPatch:item=>{calls.push(['build',item.id]);return item.id;}
  });
  assert.deepEqual(Array.from(result),['large','small']);
  assert.deepEqual(calls,[['group',1],['measure','components',0.1],['build','large'],['build','small']]);
});

test('lazy script chain and offline precache load all patch modules before the facade',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const modules=[...files.slice(0,3),files[3],files[4]];
  for(const module of modules){
    assert.ok(lazy.indexOf(module)<lazy.indexOf('"src/services/lc-patches.js"'),`${module} must precede facade in lazy chain`);
    assert.ok(sw.includes("'/"+module+"'`".replace("'`","'")),`${module} must be precached`);
  }
});
