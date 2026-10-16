import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function runtime(){const window={};for(const file of ['src/adapters/trees/update-measurement-if-current.js','src/adapters/trees/persist-measurement-record.js'])if(existsSync(new URL('../'+file,import.meta.url)))vm.runInNewContext(read(file),{window});return window;}
function clientFor(responses){const calls=[];return{calls,from(){let payload,kind;const filters=[];const chain={update(v){kind='update';payload=v;return chain},insert(v){kind='insert';payload=v;return chain},eq(k,v){filters.push([k,v]);return chain},is(k,v){filters.push([k,v]);return chain},select(){return chain},then(resolve){calls.push({kind,payload:{...payload},filters});return Promise.resolve(responses.shift()).then(resolve)}};return chain}};}
const baseline={id:7,owner:'u1',height_m:10,photo_url:null,status:'Beklemede'};

test('online edit requires an actual server row before reporting success',async()=>{
 const w=runtime(),client=clientFor([{data:[],error:null}]);
 const result=await w.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record:{owner:'u1',height_m:12},editId:7,baseline});
 assert.ok(result.error,'zero-row updates must not complete/reset the form');
});
test('online write errors never strip evidence or retry unrelated failures',async()=>{
 const w=runtime();for(const code of ['23505','23514','42501','PGRST301']){const record={owner:'u1',client_id:'c1',altitude_m:123,photo_file:'P001.JPG'},client=clientFor([{error:{code,message:'failure'},data:null},{error:null,data:[{id:1}]}]);
 const result=await w.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record,editId:null});assert.equal(result.error?.code,code);assert.equal(client.calls.length,1);assert.equal(record.altitude_m,123);assert.equal(record.photo_file,'P001.JPG');}
});
test('old-schema fallback removes only the optional column identified by the server and keeps the draft',async()=>{
 const w=runtime(),record={owner:'u1',altitude_m:123,photo_file:'P001.JPG'},client=clientFor([{error:{code:'PGRST204',message:"Could not find the 'photo_file' column of 'measurements' in the schema cache"},data:null},{error:null,data:[{id:1}]}]);
 const result=await w.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record,editId:null});assert.equal(result.error,null);assert.equal(client.calls.length,2);assert.equal(client.calls[1].payload.altitude_m,123);assert.equal(Object.hasOwn(client.calls[1].payload,'photo_file'),false);assert.equal(record.photo_file,'P001.JPG');
});
test('online edits compare the original snapshot and keep primary-key scope with a fresh write identity',async()=>{
 const w=runtime(),client=clientFor([{error:null,data:[{id:7}]}]);
 const result=await w.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record:{owner:'u1',client_id:'new-client',height_m:12},editId:7,baseline:{...baseline,client_id:'original-client'}});
 assert.equal(result.error,null);assert.ok(client.calls[0].filters.some(([k,v])=>k==='height_m'&&v===10));assert.ok(client.calls[0].filters.some(([k,v])=>k==='photo_url'&&v===null));assert.ok(client.calls[0].filters.some(([k,v])=>k==='id'&&v===7));assert.equal(client.calls[0].payload.client_id,'new-client');
});
test('edits with missing or mismatched snapshots stop before any request',async()=>{
 const w=runtime();for(const original of [null,{id:8,owner:'u1'},{id:7,owner:'other'}]){const client=clientFor([]);const result=await w.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record:{owner:'u1'},editId:7,baseline:original});assert.ok(result.error);assert.equal(client.calls.length,0);}
});
