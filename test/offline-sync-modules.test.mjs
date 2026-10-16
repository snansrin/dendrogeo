import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
  '../src/domain/offline/prepare-measurement-sync-payload.js',
  '../src/adapters/offline/find-saved-measurement.js',
  '../src/adapters/offline/upload-queued-measurement-photo.js',
  '../src/adapters/offline/persist-queued-measurement.js',
  '../src/application/offline/sync-queued-measurement.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of files)vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),context);return window;}

test('offline sync payload excludes only queue-local fields',()=>{
  const window=setup(),data={owner:'u1',client_id:'c1',photoBlob:{size:1},_editId:9,photo_file:'tree.jpg',lat:41};
  const payload=window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build(data);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)),{owner:'u1',client_id:'c1',photo_file:'tree.jpg',lat:41});
  assert.ok(data.photoBlob);assert.equal(data._editId,9);
});

test('saved lookup scopes by client and owner then verifies exact row identity',async()=>{
  const window=setup(),calls=[],data={owner:'u1',client_id:'c1'};
  const client={from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},async maybeSingle(){return{data:{id:3},error:null};}};}};
  const result=await window.DG_FIND_SAVED_OFFLINE_MEASUREMENT.find({client,data,sameMeasurement:(local,remote)=>remote.id===3});
  assert.equal(result.id,3);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['from','measurements'],['select','*'],['eq','client_id','c1'],['eq','owner','u1']]);
  assert.equal(await window.DG_FIND_SAVED_OFFLINE_MEASUREMENT.find({client,data:{...data,client_id:''},sameMeasurement:()=>true}),null);
});

test('queued photo keeps owner path, timestamp and jpeg upload settings',async()=>{
  const window=setup(),calls=[];
  const client={storage:{from(bucket){calls.push(['bucket',bucket]);return{async upload(path,blob,options){calls.push(['upload',path,blob,options]);return{error:null};},getPublicUrl(path){calls.push(['public',path]);return{data:{publicUrl:'https://photo.test/tree.jpg'}};}};}}};
  const url=await window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO.upload({client,data:{owner:'u1',photoBlob:{id:1}},recordId:4,now:()=>123});
  assert.equal(url,'https://photo.test/tree.jpg');assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['bucket','dendro-photos'],['upload','u1/123_4.jpg',{id:1},{contentType:'image/jpeg'}],['bucket','dendro-photos'],['public','u1/123_4.jpg']]);
});

test('queued measurement persistence retains owner filtered update and insert query shapes',async()=>{
  const window=setup(),calls=[];
  const client={from(table){calls.push(['from',table]);return{update(payload){calls.push(['update',payload]);return this;},insert(payload){calls.push(['insert',payload]);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},is(key,value){calls.push(['is',key,value]);return this;},select(columns){calls.push(['select',columns]);return this;}};}};
  await window.DG_PERSIST_QUEUED_MEASUREMENT.save({client,payload:{lat:1},editId:7,owner:'u1',baseline:{id:7,owner:'u1',height_m:10,photo_url:null}});
  await window.DG_PERSIST_QUEUED_MEASUREMENT.save({client,payload:{lat:2},editId:null,owner:'u1'});
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['from','measurements'],['update',{lat:1}],['eq','id',7],['eq','owner','u1'],['eq','height_m',10],['is','photo_url',null],['select','id'],['from','measurements'],['insert',{lat:2}],['select','id']]);
});

test('sync use case stops on account changes and reports saved result',async()=>{
  const window=setup(),record={id:5,data:{owner:'u1',client_id:'c1',photoBlob:{},point_id:2,measurement_no:1}},events=[];
  const base={record,owner:'u1',client:{},isCurrent:()=>true,findSaved:async()=>null,preparePayload:window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build,
    uploadPhoto:async()=>{events.push('upload');return'/photo';},persist:async({payload})=>{events.push(payload.photo_url);return{data:[{id:8}]};}};
  const saved=await window.DG_SYNC_QUEUED_MEASUREMENT.run(base);
  assert.equal(saved.saved.id,8);assert.deepEqual(events,['upload','/photo']);
  let reads=0;const stopped=await window.DG_SYNC_QUEUED_MEASUREMENT.run({...base,isCurrent:()=>false,findSaved:async()=>{reads++;return null;}});
  assert.deepEqual(JSON.parse(JSON.stringify(stopped)),{stopped:true});assert.equal(reads,1);
});

test('sync rejects unproven duplicate inserts and failed server acknowledgements',async()=>{
  const window=setup(),record={id:5,data:{owner:'u1',client_id:'c1',point_id:2}};
  const common={record,owner:'u1',isCurrent:()=>true,findSaved:async()=>null,preparePayload:window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build,uploadPhoto:async()=>'',persist:async()=>({error:{code:'23505',message:'duplicate'}})};
  await assert.rejects(window.DG_SYNC_QUEUED_MEASUREMENT.run(common),/duplicate/);
  await assert.rejects(window.DG_SYNC_QUEUED_MEASUREMENT.run({...common,persist:async()=>({data:[]})}),/Sunucu kaydı doğrulanamadı/);
});
