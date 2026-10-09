import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const geometrySource=readFileSync(new URL('../src/domain/surface/query-green-patches.js',import.meta.url),'utf8');
const patchServiceSource=readFileSync(new URL('../src/services/lc-patches.js',import.meta.url),'utf8');
const query=()=>{const ctx=vm.createContext({window:{}});vm.runInContext(geometrySource,ctx);return ctx.window.DG_SURFACE_GREEN_PATCH_QUERY;};

test('green point query uses raw rings and ignores non-green patches',()=>{
  const api=query(),seen=[];
  const raw=[[[1,2],[3,4],[5,6]]],smooth=[[[7,8],[9,10],[11,12]]];
  const patches=[{classKey:'hard',ringsRaw:raw},{classKey:'green',ringsRaw:raw,rings:smooth}];
  const inside=api.isPointInGreenPatch(40,32,patches,(lat,lon,rings)=>{seen.push([lat,lon,rings]);return rings===raw;});
  assert.equal(inside,true);
  assert.deepEqual(seen.map(x=>x.slice(0,2)),[[40,32]]);
  assert.equal(seen[0][2],raw);
});

test('legacy group field remains readable and missing patches return false',()=>{
  const api=query();
  assert.equal(api.hasGreenPatch([{group:'green'}]),true);
  assert.equal(api.hasGreenPatch([{classKey:'hard'}]),false);
  assert.equal(api.hasGreenPatch(null),false);
  assert.equal(api.isPointInGreenPatch(0,0,null,()=>true),false);
});

test('lc-patches keeps its global API while delegating patch queries',()=>{
  const raw=[[[1,2],[3,4],[5,6]]];
  const patches=[{classKey:'green',ringsRaw:raw,rings:[]}];
  const window={DG_SURFACE_PATCH_GEOMETRY:{pointInRings:(_lat,_lon,rings)=>rings===raw}};
  const ctx=vm.createContext({window,DG_LC_LAST:{patches}});
  vm.runInContext(geometrySource,ctx);
  vm.runInContext(patchServiceSource,ctx);
  assert.equal(vm.runInContext('dgLcIsGreen(40,32)',ctx),true);
  assert.equal(vm.runInContext('dgLcHasGreen()',ctx),true);
  ctx.DG_LC_LAST=null;
  assert.equal(vm.runInContext('dgLcIsGreen(40,32)',ctx),false);
  assert.equal(vm.runInContext('dgLcHasGreen()',ctx),false);
});
