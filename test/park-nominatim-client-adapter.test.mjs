import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/adapters/parks/nominatim-client.js',import.meta.url),'utf8');

function create(options={}){
  const context=vm.createContext({window:{},fetch,URLSearchParams,AbortController,Date,setTimeout,clearTimeout});
  vm.runInContext(source,context);
  return context.window.DG_NOMINATIM_CLIENT_ADAPTER.create(options);
}

test('Nominatim adapter preserves the endpoint, query parameters, and JSON accept header',async()=>{
  let request;
  const client=create({fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>[{osm_id:7}]};}});
  const result=await client.request({path:'search',query:{q:'[park]',format:'jsonv2'}});
  assert.equal(request.url,'https://nominatim.openstreetmap.org/search?q=%5Bpark%5D&format=jsonv2');
  assert.equal(request.options.headers.Accept,'application/json');
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.equal(JSON.parse(JSON.stringify(result))[0].osm_id,7);
});

test('requests stay serialized and respect the minimum request interval',async()=>{
  const starts=[];
  let active=0,maxActive=0;
  const client=create({minIntervalMs:20,timeoutMs:100,fetchImpl:async()=>{
    starts.push(Date.now());
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,2));
    active--;
    return{ok:true,json:async()=>[]};
  }});
  await Promise.all([
    client.request({path:'search',query:{q:'one'}}),
    client.request({path:'lookup',query:{q:'two'}})
  ]);
  assert.equal(maxActive,1);
  assert.ok(starts[1]-starts[0]>=18);
});

test('HTTP and malformed JSON failures leave the serialized queue usable',async()=>{
  let call=0;
  const client=create({fetchImpl:async()=>{
    call++;
    if(call===1)return{ok:false,status:503,json:async()=>[]};
    if(call===2)return{ok:true,json:async()=>({elements:[]})};
    return{ok:true,json:async()=>[]};
  }});
  await assert.rejects(client.request({path:'search',query:{}}),/OSM sınır servisi HTTP 503/);
  await assert.rejects(client.request({path:'lookup',query:{}}),/OSM sınır yanıtı geçersiz/);
  assert.deepEqual(JSON.parse(JSON.stringify(await client.request({path:'search',query:{}}))),[]);
});

test('requests abort at the configured timeout and clear the timer',async()=>{
  let cleared=false;
  const client=create({timeoutMs:5,clearTimer:timer=>{cleared=true;clearTimeout(timer);},fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  })});
  await assert.rejects(client.request({path:'search',query:{}}),/aborted/);
  assert.equal(cleared,true);
});
