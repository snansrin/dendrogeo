import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function load(path,window={}){
 vm.runInNewContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{window,AbortController});
 return window;
}
test('accepted surface reader returns only the existing RPC result and propagates rejection',async()=>{
 const api=load('src/adapters/surface/read-accepted-park-surface.js').DG_READ_ACCEPTED_PARK_SURFACE;
 const result={areas:{water:12}},calls=[];
 assert.equal(await api.load({rpc:async(...args)=>{calls.push(args);return{data:{result}};}},'25'),result);
 assert.equal(JSON.stringify(calls),'[["dg_accepted_park_surface",{"p_park":25}]]');
 assert.equal(await api.load({rpc:async()=>({data:null})},25),null);
 const error=Error('denied');await assert.rejects(api.load({rpc:async()=>({error})},25),e=>e===error);
});
test('export filter adapter requests only filter columns and leaves authorization to the client',async()=>{
 const calls=[],client={from(table){calls.push(table);return{select(fields){calls.push(fields);return{order(field){calls.push(field);return Promise.resolve({data:[]});},then(resolve){resolve({data:[]});}};}};}};
 const api=load('src/adapters/admin/admin-export-filter-store.js').DG_ADMIN_EXPORT_FILTER_STORE.create(()=>client);
 assert.equal((await api.load()).length,2);
 assert.deepEqual(calls,['measurements','country,city','projects','id,name,country,city','name']);
});
test('public scene fetch omits credentials, shares requests and permits retry after failure',async()=>{
 const calls=[],timers=new Set();let fail=true;
 const api=load('src/adapters/landing/load-public-scene.js',{
  setTimeout(fn){const id={fn};timers.add(id);return id;},clearTimeout(id){timers.delete(id);},
  async fetch(url,options){calls.push({url,options});return{ok:!fail,json:async()=>({public:true})};}
 }).DG_PUBLIC_LANDING_SCENE;
 const first=api.load('/assets/landing/test.json?v=1');assert.equal(api.load('/assets/landing/test.json?v=1'),first);
 await assert.rejects(first,/Scene unavailable/);fail=false;
 assert.equal((await api.load('/assets/landing/test.json?v=1')).public,true);
 assert.equal(calls.length,2);assert.equal(timers.size,0);
 for(const {options}of calls){assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);assert.ok(options.signal instanceof AbortSignal);}
});
