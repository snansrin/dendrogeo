import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function store(){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../src/adapters/visitors/stored-activity-store.js',import.meta.url),'utf8'),{window});
 return window.DG_VISITOR_STORED_ACTIVITY_STORE.create();
}

function clientFor(results,failures=[]){
 const calls=[];
 const client={from(table){
  const call={table};calls.push(call);
  return{
   select(columns){call.columns=columns;return this;},
   order(column,options){call.order=[column,options];return this;},
   limit(value){call.limit=value;return failures.includes(table)?Promise.reject(Error('query failed')):Promise.resolve({data:results[table]});}
  };
 }};
 return{client,calls};
}

test('stored activity store preserves the four query shapes, order and limits',async()=>{
 const {client,calls}=clientFor({measurements:[{id:1}],projects:[{id:2}],data_requests:[{id:3}],report_requests:[{id:4}]});
 const result=await store().load(client);
 assert.deepEqual(JSON.parse(JSON.stringify(Array.from(calls,call=>[call.table,call.columns,call.order,call.limit]))),[
  ['measurements','id,point_id,species,status,created_at,profiles!measurements_owner_fkey(full_name)',['created_at',{ascending:false}],40],
  ['projects','id,name,created_at,profiles(full_name)',['created_at',{ascending:false}],20],
  ['data_requests','id,email,status,created_at',['created_at',{ascending:false}],20],
  ['report_requests','id,status,created_at,park_id',['created_at',{ascending:false}],20]
 ]);
 assert.deepEqual(Object.values(result).map(rows=>rows.length),[1,1,1,1]);
});

test('a failed activity query leaves its list empty and does not block the other sources',async()=>{
 const {client,calls}=clientFor({projects:[{id:2}],data_requests:[{id:3}],report_requests:[{id:4}]},['measurements']);
 const result=await store().load(client);
 assert.deepEqual(Object.values(result).map(rows=>rows.length),[0,1,1,1]);
 assert.equal(calls.length,4);
});

test('missing query data keeps the source list empty',async()=>{
 const result=await store().load(clientFor({}).client);
 assert.deepEqual(Object.values(result).map(rows=>Array.from(rows)),[[],[],[],[]]);
});
