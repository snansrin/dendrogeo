import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('yielding OSM refinement preserves every cell, aggregate and raw input',async()=>{
 const c=vm.createContext({window:{}});
 for(const path of ['src/application/surface/refine-water-by-osm.js','src/application/surface/refine-hard-by-osm.js','src/application/surface/apply-osm-surface-refinement.js'])vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),c);
 const cells=Array.from({length:257},(_,i)=>({row:i,col:0,classKey:'green',areaM2:100,center:{lat:i,lon:0},quadWgs:[[0,i],[1,i],[1,i+1],[0,i+1]]}));
 const source={result:{cells,groupCounts:{green:257},groupAreas:{green:25700},rawCounts:{10:257},rawAreas:{10:25700},maskedCount:0,maskedAreaM2:0,classifiedAreaM2:25700}};
 const before=JSON.stringify(source),w=c.window,ports={fetchWater:async()=>[[[0,0]]],fetchRoads:async()=>[{pts:[[0,0],[300,0]],halfWidth:1}],refineWater:(r,rings)=>w.DG_REFINE_WATER_BY_OSM.refine(r,rings,lat=>lat%3===0),refineRoads:(r,roads,epsg)=>w.DG_REFINE_HARD_BY_OSM.refine(r,roads,epsg,(lat,lon)=>({x:lon,y:lat})),epsg:32630};
 const expected=await w.DG_APPLY_OSM_SURFACE_REFINEMENT.apply(source,ports);let ticks=0;
 const actual=await w.DG_APPLY_OSM_SURFACE_REFINEMENT.apply(source,{...ports,yieldTask:()=>new Promise(resolve=>setTimeout(()=>{ticks++;resolve();},0))});
 assert.equal(JSON.stringify(actual),JSON.stringify(expected));assert.equal(JSON.stringify(source),before);assert.equal(actual.result.cells.length,257);assert.equal(ticks,18);
});
