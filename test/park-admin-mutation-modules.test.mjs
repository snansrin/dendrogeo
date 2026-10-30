import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function setup(){const window={};const context=vm.createContext({window});for(const path of ['src/adapters/parks/park-admin-mutation-store.js','src/ui/park-admin-mutation.js'])vm.runInContext(read(path),context,{filename:path});return window;}

test('park-admin mutation adapter preserves table, payload, and id scopes',async()=>{
  const calls=[];const client={from(table){calls.push(['from',table]);return this;},update(payload){calls.push(['update',payload]);return this;},delete(){calls.push(['delete']);return this;},eq(column,value){calls.push(['eq',column,value]);return this;},select(columns){calls.push(['select',columns]);return Promise.resolve({data:[{id:7}],error:null});}};
  const store=setup().DG_PARK_ADMIN_MUTATION_STORE.create({getClient:()=>client});
  await store.updatePark(7,{name:'Göksu',name_norm:'göksu'});
  await store.moveProjects(7,8);await store.moveMeasurements(7,8);await store.deletePark(7);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ['from','parks'],['update',{name:'Göksu',name_norm:'göksu'}],['eq','id',7],['select','id'],
    ['from','projects'],['update',{park_id:8}],['eq','park_id',7],
    ['from','measurements'],['update',{park_id:8}],['eq','park_id',7],
    ['from','parks'],['delete'],['eq','id',7],['select','id']
  ]);
});

test('park identity adapter turns silent zero-row writes into actionable errors',async()=>{
  const client={from(){return this;},update(){return this;},delete(){return this;},eq(){return this;},select:async()=>({data:[],error:null})};
  const store=setup().DG_PARK_ADMIN_MUTATION_STORE.create({getClient:()=>client});
  assert.match((await store.updatePark(7,{name:'Yeni'})).error.message,/güncellenmedi/);
  assert.match((await store.deletePark(7)).error.message,/silinmedi/);
});

test('park mutation adapter converts thrown transport failures to visible errors',async()=>{
  const failure=new Error('network unavailable'),client={from(){return this;},update(){return this;},delete(){return this;},eq(){return this;},select:async()=>{throw failure;}};
  const store=setup().DG_PARK_ADMIN_MUTATION_STORE.create({getClient:()=>client});
  assert.equal((await store.updatePark(7,{name:'Yeni'})).error,failure);
  assert.equal((await store.deletePark(7)).error,failure);
});

test('park rename UI reports partial success and reloads the persisted identity',async()=>{
  const feedback=[],events=[],window={dgParkRename:async()=>{throw new Error('project RLS denied');},toast:(...args)=>feedback.push(args),dgAfterParkAdminChange:async()=>events.push('refresh')},context=vm.createContext({window});
  vm.runInContext(read('src/ui/guard-park-rename-feedback.js'),context);
  assert.equal(await window.dgParkRename(7),false);
  assert.match(feedback[0][0],/Park adı kaydedildi/);assert.match(feedback[0][0],/project RLS denied/);assert.deepEqual(events,['refresh']);
});

test('park-admin UI keeps confirmation wording and result feedback',async()=>{
  const ui=setup().DG_PARK_ADMIN_MUTATION_UI,events=[];
  const translated=value=>'T:'+value,translateFormat=(value,params)=>value.replace('{src}',params.src).replace('{dst}',params.dst).replace('{sid}',params.sid).replace('{did}',params.did);
  assert.equal(ui.promptRename({name:'Park'},{prompt:(...args)=>{events.push(args);return 'Yeni';},translate:translated}),'Yeni');
  assert.deepEqual(events.shift(),['T:Park adı (örn. Göksu Parkı):','Park']);
  assert.equal(ui.confirmMerge({name:'A',id:1},{name:'B',id:2},{confirm:value=>{events.push(value);return true;},translateFormat}),true);
  assert.match(events.shift(),/Projeler ve ölçümler hedef parka taşınır/);
  const sandbox=setup();sandbox.DG_TYPED_DELETE_CONFIRM={ask:input=>{events.push(input);return Promise.resolve(true);}};
  assert.equal(await sandbox.DG_PARK_ADMIN_MUTATION_UI.confirmDelete({name:'B',id:2},{}),true);
  const requested=events.shift();assert.equal(requested.kind,'park');assert.equal(requested.id,2);
  assert.equal(requested.name,'B');assert.match(requested.warning,/ÖLÇÜM SİLİNMEZ/);
  const feedback=[];const ports={translate:value=>'T:'+value,translateCommon:value=>'C:'+value,translateFormat:value=>'T:'+value,escape:value=>'E:'+value,toast:(...args)=>feedback.push(args)};
  assert.equal(ui.renameResult({status:'write-failed',error:{message:'denied'}},ports),false);
  assert.deepEqual(feedback.pop(),['C:Ad güncellenemedi: E:denied','err']);
  assert.equal(ui.mergeResult({status:'merged',sourceId:1,destinationId:2,measurementError:{message:'partial'}},ports),true);
  assert.deepEqual(feedback,[['C:Ölçümler taşınırken hata: E:partial','warn'],['T:✓ #{a} → #{b} birleştirildi','ok','🔀']]);
  assert.equal(ui.deleteResult({status:'deleted'},ports),true);
  assert.deepEqual(feedback.at(-1),['✓ Park kimliği silindi','ok','🗑️']);
});

test('service routes park identity writes exclusively through the mutation adapter',()=>{
  const service=read('src/services/park-registry.js'),controller=read('src/bootstrap/park-admin-controller.js'),composition=service+'\n'+controller;
  const head=read('partials/head.html'),sw=read('sw.js');
  for(const token of ['DG_PARK_ADMIN_MUTATION_STORE','DG_PARK_ADMIN_MUTATION_UI','DG_PARK_ADMIN_RENAME','DG_PARK_ADMIN_MERGE','DG_PARK_ADMIN_DELETE'])assert.ok(composition.includes(token),token);
  for(const path of ['src/adapters/parks/park-admin-mutation-store.js','src/ui/park-admin-mutation.js']){assert.ok(head.indexOf(path)<head.indexOf('src/services/park-registry.js'),`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(head.indexOf('src/ui/guard-park-rename-feedback.js')>head.indexOf('src/services/park-registry.js'));
  assert.ok(sw.includes("'/src/ui/guard-park-rename-feedback.js'"));
  for(const call of ['mutationStore.updatePark(parkId,patch)','mutationStore.moveProjects(source,destination)','mutationStore.moveMeasurements(source,destination)','mutationStore.deletePark(parkId)'])assert.ok(controller.includes(call),call);
  const adminWrites=controller;
  assert.doesNotMatch(adminWrites,/sb\.from\("(?:parks|projects|measurements)"\)\.(?:update|delete)/,'park rename, merge and deletion cannot bypass the guarded adapter');
});
