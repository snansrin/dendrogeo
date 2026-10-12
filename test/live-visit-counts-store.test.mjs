import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function store(){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../src/adapters/visitors/live-visit-counts-store.js',import.meta.url),'utf8'),{window});
 return window.DG_VISITOR_LIVE_VISIT_COUNTS_STORE.create();
}

function clientFor(counts,{failAt=-1}={}){
 const calls=[];
 const client={from(table){
  assert.equal(table,'site_visits');
  const call={table},index=calls.push(call)-1;
  return{
   select(columns,options){call.columns=columns;call.options=options;return this;},
   gte(column,value){call.gte=[column,value];return this;},
   then(resolve,reject){
    if(index===failAt)return Promise.reject(Error('count failed')).then(resolve,reject);
    return Promise.resolve({count:counts[index]}).then(resolve,reject);
   }
  };
 }};
 return{client,calls};
}

test('live visit count store preserves exact count requests and local date windows',async()=>{
 const now=new Date(2026,9,12,15,30).getTime();
 const {client,calls}=clientFor([500,12,88]);
 const result=await store().load(client,{now});
 const today=new Date(now);today.setHours(0,0,0,0);
 const sevenDays=new Date(now-7*86400000);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {table:'site_visits',columns:'*',options:{count:'exact',head:true}},
  {table:'site_visits',columns:'*',options:{count:'exact',head:true},gte:['visited_at',today.toISOString()]},
  {table:'site_visits',columns:'*',options:{count:'exact',head:true},gte:['visited_at',sevenDays.toISOString()]}
 ]);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{total:500,today:12,sevenDays:88});
});

test('live visit count store rejects a failed request so the caller can keep its existing catch behavior',async()=>{
 const {client,calls}=clientFor([500,12,88],{failAt:1});
 await assert.rejects(store().load(client),/count failed/);
 assert.equal(calls.length,3);
});

test('null counts retain the existing zero fallback',async()=>{
 const {client}=clientFor([null,undefined,0]);
 assert.deepEqual(JSON.parse(JSON.stringify(await store().load(client))),{total:0,today:0,sevenDays:0});
});
