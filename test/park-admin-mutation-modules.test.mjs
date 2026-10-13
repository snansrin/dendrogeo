import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function setup(){const window={};const context=vm.createContext({window});for(const path of ['src/adapters/parks/park-admin-mutation-store.js','src/ui/park-admin-mutation.js'])vm.runInContext(read(path),context,{filename:path});return window;}

test('park-admin mutation adapter preserves table, payload, and id scopes',async()=>{
  const calls=[];const client={from(table){calls.push(['from',table]);return this;},update(payload){calls.push(['update',payload]);return this;},delete(){calls.push(['delete']);return this;},eq(column,value){calls.push(['eq',column,value]);return Promise.resolve({error:null});}};
  const store=setup().DG_PARK_ADMIN_MUTATION_STORE.create({getClient:()=>client});
  await store.updatePark(7,{name:'Göksu',name_norm:'göksu'});
  await store.moveProjects(7,8);await store.moveMeasurements(7,8);await store.deletePark(7);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ['from','parks'],['update',{name:'Göksu',name_norm:'göksu'}],['eq','id',7],
    ['from','projects'],['update',{park_id:8}],['eq','park_id',7],
    ['from','measurements'],['update',{park_id:8}],['eq','park_id',7],
    ['from','parks'],['delete'],['eq','id',7]
  ]);
});

test('park-admin UI keeps confirmation wording and result feedback',()=>{
  const ui=setup().DG_PARK_ADMIN_MUTATION_UI,events=[];
  const translated=value=>'T:'+value,translateFormat=(value,params)=>value.replace('{src}',params.src).replace('{dst}',params.dst).replace('{sid}',params.sid).replace('{did}',params.did);
  assert.equal(ui.promptRename({name:'Park'},{prompt:(...args)=>{events.push(args);return 'Yeni';},translate:translated}),'Yeni');
  assert.deepEqual(events.shift(),['T:Park adı (örn. Göksu Parkı):','Park']);
  assert.equal(ui.confirmMerge({name:'A',id:1},{name:'B',id:2},{confirm:value=>{events.push(value);return true;},translateFormat}),true);
  assert.match(events.shift(),/Projeler ve ölçümler hedef parka taşınır/);
  assert.equal(ui.confirmDelete({name:'B',id:2},{confirm:value=>{events.push(value);return true;}}),true);
  assert.match(events.shift(),/ÖLÇÜM SİLİNMEZ/);
  const feedback=[];const ports={translate:value=>'T:'+value,translateCommon:value=>'C:'+value,translateFormat:value=>'T:'+value,escape:value=>'E:'+value,toast:(...args)=>feedback.push(args)};
  assert.equal(ui.renameResult({status:'write-failed',error:{message:'denied'}},ports),false);
  assert.deepEqual(feedback.pop(),['C:Ad güncellenemedi: E:denied','err']);
  assert.equal(ui.mergeResult({status:'merged',sourceId:1,destinationId:2,measurementError:{message:'partial'}},ports),true);
  assert.deepEqual(feedback,[['C:Ölçümler taşınırken hata: E:partial','warn'],['T:✓ #{a} → #{b} birleştirildi','ok','🔀']]);
  assert.equal(ui.deleteResult({status:'deleted'},ports),true);
  assert.deepEqual(feedback.at(-1),['✓ Park kimliği silindi','ok','🗑️']);
});

test('service composes mutation adapter and UI while retaining inline fallbacks',()=>{
  const service=read('src/services/park-registry.js');
  const head=read('partials/head.html'),sw=read('sw.js');
  for(const token of ['DG_PARK_ADMIN_MUTATION_STORE','DG_PARK_ADMIN_MUTATION_UI','DG_PARK_ADMIN_RENAME','DG_PARK_ADMIN_MERGE','DG_PARK_ADMIN_DELETE'])assert.ok(service.includes(token),token);
  for(const path of ['src/adapters/parks/park-admin-mutation-store.js','src/ui/park-admin-mutation.js']){assert.ok(head.indexOf(path)<head.indexOf('src/services/park-registry.js'),`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.match(service,/DG_PARK_ADMIN_MUTATION_STORE\?DG_PARK_ADMIN_MUTATION_STORE\.moveProjects/);
  assert.match(service,/sb\.from\("projects"\)\.update\(\{park_id:dstId\}\)\.eq\("park_id",srcId\)/);
});
