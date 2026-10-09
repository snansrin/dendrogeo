import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/surface/measure-patch-components.js',import.meta.url),'utf8'),ctx);
const summarize=(components,minHa)=>ctx.window.DG_SURFACE_PATCH_METRICS.summarizeComponents(components,minHa);
const cell=(areaM2,lat,lon)=>({areaM2,center:{lat,lon}});

test('component metrics use cell areas for exact area-weighted centroid',()=>{
  const a=[cell(25,10,20),cell(75,14,28)];
  const [result]=summarize([a],0);
  assert.equal(result.areaM2,100);
  assert.equal(result.centroid.lat,13);
  assert.equal(result.centroid.lon,26);
  assert.equal(result.cells,a);
});

test('default minimum area threshold remains 0.05 ha and explicit values are honored',()=>{
  assert.equal(summarize([[cell(499,1,1)],[cell(500,2,2)] ]).length,1);
  assert.equal(summarize([[cell(999,1,1)],[cell(1000,2,2)]],0.1).length,1);
});

test('results are ordered by descending area and empty input stays empty',()=>{
  const out=summarize([[cell(200,2,2)],[cell(500,5,5)],[cell(300,3,3)]],0);
  assert.deepEqual(Array.from(out,x=>x.areaM2),[500,300,200]);
  assert.deepEqual(Array.from(summarize([],0)),[]);
});
