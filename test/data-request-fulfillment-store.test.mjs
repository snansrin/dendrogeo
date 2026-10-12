import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/fulfillment-store.js',import.meta.url),'utf8'),{window});
const load=window.DG_DATA_REQUEST_FULFILLMENT_STORE.load;
function client({request={},projects=[],rows=[],rejectTable=null}={}){
 const calls=[];
 const sb={from(table){calls.push(['from',table]);const q={
  select(columns){calls.push(['select',columns]);return q;},
  eq(column,value){calls.push(['eq',column,value]);return q;},
  ilike(column,value){calls.push(['ilike',column,value]);return q;},
  in(column,values){calls.push(['in',column,Array.from(values)]);return q;},
  single(){return table===rejectTable?Promise.reject(Error('offline')):Promise.resolve({data:request});},
  then(resolve,reject){return (table===rejectTable?Promise.reject(Error('offline')):Promise.resolve({data:table==='projects'?projects:rows})).then(resolve,reject);}
 };return q;}};
 return{sb,calls};
}

test('fulfillment store preserves request/project/approved dataset query sequence and all filters',async()=>{
 const request={country:'TR',city:'Ankara',project_name:'Park'},rows=[{id:1}],a=client({request,projects:[{id:7},{id:8}],rows});
 const result=await load(a.sb,9);
 assert.equal(result.request,request);assert.equal(result.rows,rows);
 assert.deepEqual(a.calls,[['from','data_requests'],['select','*,profiles(full_name)'],['eq','id',9],['from','projects'],['select','id'],['ilike','name','%Park%'],['from','measurements'],['select','*'],['eq','status','Onaylı'],['eq','country','TR'],['eq','city','Ankara'],['in','project_id',[7,8]]]);
});

test('fulfillment store keeps unmatched project sentinel and null result fallback',async()=>{
 for(const projects of [[],null]){
  const a=client({request:{project_name:'Missing'},projects,rows:null}),result=await load(a.sb,9);
  assert.deepEqual(a.calls.at(-1),['in','project_id',[-1]]);assert.equal(result.rows.length,0);
 }
});

test('fulfillment store skips absent filters and stops immediately on missing request',async()=>{
 const a=client();await load(a.sb,9);
 assert.deepEqual(a.calls,[['from','data_requests'],['select','*,profiles(full_name)'],['eq','id',9],['from','measurements'],['select','*'],['eq','status','Onaylı']]);
 const b=client({request:null});assert.equal(await load(b.sb,9),null);assert.equal(b.calls.length,3);
});

test('fulfillment store preserves transport rejection without reading later tables',async()=>{
 for(const table of ['data_requests','projects','measurements']){
  const a=client({request:{project_name:'Park'},rejectTable:table});
  await assert.rejects(load(a.sb,9),/offline/);
  assert.equal(a.calls.filter(c=>c[0]==='from').at(-1)[1],table);
 }
});
