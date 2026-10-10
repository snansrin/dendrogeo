import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/detect-park.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_DETECTION_APPLICATION.create;
function setup(overrides={}){
  const calls={queries:[],anchors:[],candidates:[],manual:[],drawn:[],notices:[],warnings:[]};
  const detect=create({
    isOnline:()=>true,
    queryPark:async(lat,lon,radius)=>{calls.queries.push([lat,lon,radius]);return[];},
    setAnchor:point=>calls.anchors.push(point),setCandidates:parks=>calls.candidates.push(parks),
    offerManual:(lat,lon)=>calls.manual.push([lat,lon]),drawPark:async park=>calls.drawn.push(park),
    notify:(...args)=>calls.notices.push(args),warn:error=>calls.warnings.push(error),...overrides
  });
  return{detect,calls};
}

test('validates coordinates and online state before changing the anchor',async()=>{
  const a=setup();
  await a.detect('bad',32);
  assert.deepEqual(a.calls.notices,[['invalid-location']]);
  const offline=setup({isOnline:()=>false});
  await offline.detect(39,32);
  assert.deepEqual(offline.calls.notices,[['offline']]);
  assert.equal(offline.calls.anchors.length,0);
});

test('no match opens manual flow; silent lookup returns without UI effects',async()=>{
  const a=setup();
  assert.equal(await a.detect(39,32,{radius:700}),null);
  assert.deepEqual(a.calls.queries,[[39,32,700]]);
  assert.deepEqual(a.calls.manual,[[39,32]]);
  assert.deepEqual(a.calls.notices,[['searching']]);
  const silent=setup();
  assert.equal(await silent.detect(40,33,{silent:true}),null);
  assert.equal(silent.calls.manual.length,0);
  assert.equal(silent.calls.notices.length,0);
});

test('silent success returns candidates without drawing; interactive success draws the first',async()=>{
  const parks=[{id:1},{id:2}];
  const silent=setup({queryPark:async()=>parks});
  assert.equal(await silent.detect(39,32,{silent:true}),parks);
  assert.equal(silent.calls.candidates[0],parks);
  assert.equal(silent.calls.drawn.length,0);
  const interactive=setup({queryPark:async()=>parks});
  assert.equal(await interactive.detect(39,32),parks);
  assert.deepEqual(interactive.calls.drawn,[parks[0]]);
});

test('a late response cannot replace a newer detection result',async()=>{
  let release;let count=0;
  const parks=[{id:9}];
  const a=setup({queryPark:()=>++count===1?new Promise(resolve=>{release=resolve;}):Promise.resolve(parks)});
  const older=a.detect(39,32);assert.equal(await a.detect(40,33),parks);
  release([]);assert.equal(await older,null);
  assert.deepEqual(a.calls.manual,[]);
  assert.deepEqual(a.calls.drawn,[parks[0]]);
});

test('query failures warn and show an error only for the current interactive request',async()=>{
  const error=Error('timeout');
  const failed=setup({queryPark:async()=>{throw error;}});
  assert.equal(await failed.detect(39,32),null);
  assert.equal(failed.calls.warnings[0],error);
  assert.equal(failed.calls.notices.at(-1)[0],'query-failed');
  const silent=setup({queryPark:async()=>{throw error;}});
  await silent.detect(39,32,{silent:true});
  assert.deepEqual(silent.calls.notices,[]);
});
