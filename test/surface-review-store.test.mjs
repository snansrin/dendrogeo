import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/surface/review-store.js',import.meta.url),'utf8'),ctx);
const store=ctx.window.DG_SURFACE_REVIEW_STORE;

function client(response){
  const calls=[];
  const query={
    select(value){calls.push(['select',value]);return this;},
    eq(key,value){calls.push(['eq',key,value]);return this;},
    async maybeSingle(){calls.push(['maybeSingle']);return response;}
  };
  return {calls,client:{from(table){calls.push(['from',table]);return{
    insert(row){calls.push(['insert',row]);return query;},
    update(row){calls.push(['update',row]);return query;},
    select:value=>query.select(value),eq:(key,value)=>query.eq(key,value),maybeSingle:()=>query.maybeSingle()
  };}}};
}

test('review store loads the owner scoped payload and propagates database errors',async()=>{
  const data={payload:{parkId:7},revision:4,source_fingerprint:'abc'};
  const mock=client({data,error:null});
  assert.equal(await store.load(mock.client,7,'owner-a'),data);
  assert.deepEqual(mock.calls,[['from','surface_reviews'],['select','payload,revision,source_fingerprint'],['eq','park_id',7],['eq','owner','owner-a'],['maybeSingle']]);
  const failure=new Error('database unavailable');
  await assert.rejects(store.load(client({data:null,error:failure}).client,7,'owner-a'),e=>e===failure);
});

test('review store inserts first revision and keeps the revision compare-and-set update',async()=>{
  const record={parkId:7,owner:'owner-a',fingerprint:'abc'};
  const created=client({data:{revision:1},error:null});
  assert.equal(await store.save(created.client,record,0),1);
  const inserted=created.calls.find(x=>x[0]==='insert')[1];
  assert.deepEqual(Object.keys(inserted).sort(),['owner','park_id','payload','revision','source_fingerprint','updated_at'].sort());
  assert.equal(inserted.payload,record);
  assert.equal(inserted.revision,1);
  assert.equal(Number.isNaN(Date.parse(inserted.updated_at)),false);
  assert.deepEqual(created.calls.map(x=>x[0]),['from','insert','select','maybeSingle']);

  const updated=client({data:{revision:6},error:null});
  assert.equal(await store.save(updated.client,record,5),6);
  assert.deepEqual(updated.calls.filter(x=>x[0]==='eq'),[['eq','park_id',7],['eq','owner','owner-a'],['eq','revision',5]]);
  assert.equal(updated.calls.find(x=>x[0]==='update')[1].revision,6);
});

test('review store reports stale revisions and write failures',async()=>{
  const record={parkId:7,owner:'owner-a',fingerprint:'abc'};
  await assert.rejects(store.save(client({data:null,error:null}).client,record,2),/Kayıt başka cihazda değişti/);
  const failure=new Error('write denied');
  await assert.rejects(store.save(client({data:null,error:failure}).client,record,2),e=>e===failure);
});
