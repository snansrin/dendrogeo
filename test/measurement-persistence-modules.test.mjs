import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/trees/fetch-measurement-park.js',
  'src/adapters/trees/persist-measurement-record.js',
  'src/domain/trees/build-measurement-location-fields.js',
  'src/domain/trees/build-offline-measurement-record.js',
  'src/application/trees/record-measurement-presence-action.js',
  'src/application/trees/refresh-measurement-after-save.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('measurement park adapter preserves the primary-key lookup and missing-row result',async()=>{
  const{window}=setup(),calls=[];
  const client={from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return{eq(field,id){calls.push(['eq',field,id]);return{maybeSingle:async()=>({data:{id:9,name:'Park'},error:null})};}};}};}};
  assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_FETCH_MEASUREMENT_PARK.fetch({client,id:9}))),{id:9,name:'Park'});
  assert.deepEqual(calls,[['from','parks'],['select','*'],['eq','id',9]]);
  client.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})});
  assert.equal(await window.DG_FETCH_MEASUREMENT_PARK.fetch({client,id:404}),null);
});

test('measurement adapter preserves RLS update scope and insert old-schema retry',async()=>{
  const{window}=setup(),calls=[],record={id:1,client_id:'c',altitude_m:4,photo_file:'P001_M1.JPG'};let fail=true;
  const client={from:table=>({update:row=>({eq:(field,id)=>{calls.push(['update',table,row,field,id]);return{error:null};}}),insert:row=>{calls.push(['insert',table,{...row}]);if(fail){fail=false;return{error:{message:'old schema'}};}return{error:null};}})};
  assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record,editId:7}))),{error:null});
  const result=await window.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record,editId:null});
  assert.equal(JSON.stringify(calls[0]),JSON.stringify(['update','measurements',record,'id',7]));
  assert.equal(JSON.stringify(calls.slice(1)),JSON.stringify([['insert','measurements',{id:1,client_id:'c',altitude_m:4,photo_file:'P001_M1.JPG'}],['insert','measurements',{id:1,client_id:'c'}]]));
  assert.equal(Object.hasOwn(record,'altitude_m'),false);assert.equal(Object.hasOwn(record,'photo_file'),false);assert.equal(result.error,null);
});

test('location fields preserve GPS accuracy, altitude and reverse-geocode fallbacks',()=>{
  const{window}=setup(),build=window.DG_BUILD_MEASUREMENT_LOCATION_FIELDS.build;
  assert.equal(JSON.stringify(build({fix:{latitude:40,longitude:32,accuracy:5,altitude:null},geocode:{country:'Türkiye',city:'Bolu'}})),JSON.stringify({lat:40,lon:32,accuracy_m:5,altitude_m:null,country:'Türkiye',city:'Bolu'}));
  assert.equal(JSON.stringify(build({fix:{latitude:1,longitude:2,accuracy:8,altitude:9},geocode:null})),JSON.stringify({lat:1,lon:2,accuracy_m:8,altitude_m:9,country:'Bilinmiyor',city:'Bilinmiyor'}));
});

test('offline record builder retains photo evidence, a fresh client id and edit marker',()=>{
  const{window}=setup(),record={owner:'u',project_id:4,point_id:2,client_id:'online-id'},blob={size:10};
  const offline=window.DG_BUILD_OFFLINE_MEASUREMENT_RECORD.build({record,photoBlob:blob,photoFile:'P002_M1.JPG',editId:9,clientId:'offline-id'});
  assert.equal(JSON.stringify(offline),JSON.stringify({...record,photoBlob:blob,photo_file:'P002_M1.JPG',client_id:'offline-id',_editId:9}));assert.equal(record.client_id,'online-id');
  const withoutPhoto=window.DG_BUILD_OFFLINE_MEASUREMENT_RECORD.build({record,photoBlob:null,photoFile:null,editId:null,clientId:'new-id'});assert.equal(Object.hasOwn(withoutPhoto,'photoBlob'),false);assert.equal(Object.hasOwn(withoutPhoto,'_editId'),false);
});

test('presence failures are swallowed and cannot change save success',()=>{
  const{window}=setup(),events=[];
  window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION.record('save','P007',(action,point)=>events.push([action,point]));
  window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION.record('edit','P008',()=>{throw Error('offline');});
  window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION.record('save','P009',null);
  assert.deepEqual(events,[['save','P007']]);
});

test('post-save refresh keeps online and offline side-effect order',()=>{
  const{window}=setup(),events=[],flow=window.DG_REFRESH_MEASUREMENT_AFTER_SAVE;
  const ports={wasEdit:false,reset:()=>events.push('reset'),autoFill:()=>events.push('autofill'),loadDashboard:()=>events.push('dashboard'),loadRecords:()=>events.push('records'),loadWaypoints:()=>events.push('waypoints')};
  flow.offline(ports);assert.deepEqual(events,['reset','autofill','dashboard','records']);
  events.length=0;flow.online(ports);assert.deepEqual(events,['reset','dashboard','records','waypoints','autofill']);
  events.length=0;flow.online({...ports,wasEdit:true});assert.deepEqual(events,['reset','dashboard','records','waypoints']);
});

test('six persistence modules load before measure.js, are precached and delegated',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js'),source=read('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(source.indexOf('verifyAtPark:park=>dgVerifyAtPark(park,"measure")')<source.indexOf('uploadPhoto:blob=>window.DG_UPLOAD_MEASUREMENT_PHOTO.upload'));
  assert.equal((source.match(/sb\.from\("parks"\)/g)||[]).length,0,'park reads stay behind the adapter');
  assert.equal((source.match(/DG_FETCH_MEASUREMENT_PARK\.fetch/g)||[]).length,1,'submission uses the shared measurement park adapter');
  for(const token of ['DG_SUBMIT_MEASUREMENT.run','DG_BUILD_MEASUREMENT_LOCATION_FIELDS','DG_BUILD_OFFLINE_MEASUREMENT_RECORD','DG_RECORD_MEASUREMENT_PRESENCE_ACTION','DG_REFRESH_MEASUREMENT_AFTER_SAVE'])assert.ok(source.includes(token),token);
  assert.match(read('src/adapters/trees/persist-measurement-record.js'),/DG_PERSIST_MEASUREMENT_RECORD/,'satır insert/update adapter sınırında kalır');
});
