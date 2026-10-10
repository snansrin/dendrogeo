import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/surface/prepare-review.js',import.meta.url),'utf8'),ctx);
const create=ctx.window.DG_SURFACE_REVIEW_PREPARATION.create;

test('review preparation returns a successful worker result without fallback work',async()=>{
  const expected={park:'worker-park',parts:[]};let fallbackCalls=0;
  const prepare=create({runWorker:async()=>expected,park(){fallbackCalls++;},objects(){fallbackCalls++;},cell(){fallbackCalls++;},resolved(){fallbackCalls++;},yieldTask:async()=>{fallbackCalls++;}});
  assert.equal(await prepare({}),expected);
  assert.equal(fallbackCalls,0);
});

test('review preparation falls back in bounded batches and yields between batches',async()=>{
  const calls={worker:0,objects:0,batches:[],yields:0};
  const cells=Array.from({length:130},(_,i)=>({row:Math.floor(i/10),col:i%10,classKey:i%2?'green':'hard'}));
  const prepare=create({
    runWorker:async()=>{calls.worker++;return null;},
    park:(outer,holes,epsg)=>({outer,holes,epsg}),
    objects:(elements,epsg)=>{calls.objects++;return[{type:'building',epsg}];},
    cell:(cell,park,epsg)=>({cell,park,epsg}),
    resolved:(batch,classFor,geometries,features,epsg,park)=>{calls.batches.push({size:batch.length,classes:batch.map(classFor),features,epsg,park});return batch.map(cell=>({key:cell.row+':'+cell.col}));},
    yieldTask:async()=>{calls.yields++;}
  });
  const result=await prepare({outer:[[1]],holes:[],epsg:32631,elements:[{id:1}],cells,features:[{type:'water'}]});
  assert.equal(calls.worker,1);
  assert.equal(calls.objects,1);
  assert.deepEqual(calls.batches.map(x=>x.size),[128,2]);
  assert.equal(calls.batches[0].classes[0],'hard');
  assert.equal(calls.batches[0].features.length,2);
  assert.equal(calls.yields,2);
  assert.equal(Object.keys(result.geometries).length,130);
  assert.equal(result.parts.length,130);
  assert.equal(result.park.epsg,32631);
});

test('review preparation can omit OSM objects while preserving an explicit empty object list',async()=>{
  let objectCalls=0;
  const prepare=create({runWorker:async()=>null,park:()=>[],objects:()=>{objectCalls++;return[{type:'hard'}];},cell:()=>[],resolved:(batch,classes,geometries,features)=>{assert.deepEqual(Array.from(features),[{type:'water'}]);return[];},yieldTask:async()=>{}});
  await prepare({cells:[{row:0,col:0}],outer:[],epsg:32631,objects:[],features:[{type:'water'}],useObjects:false});
  assert.equal(objectCalls,0);
});
