import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/surface/validation-campaign-store.js',
  'src/application/surface/validation-campaign-archive.js',
  'src/application/surface/validation-campaign-save-queue.js',
  'src/application/surface/handle-validation-campaign-save-failure.js',
  'src/domain/surface/select-validation-campaign.js'
];
function setup(extra={}){const window={};const context=vm.createContext({window,queueMicrotask,...extra});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

function fakeIndexedDB(){
  const records=new Map(),events=[];
  return{records,events,open(name,version){events.push(['open',name,version]);const request={};const db={objectStoreNames:{contains:name=>events.some(event=>event[0]==='create'&&event[1]===name)},createObjectStore:(name,options)=>events.push(['create',name,options.keyPath]),transaction:(name,mode)=>{events.push(['transaction',name,mode]);const tx={objectStore:storeName=>({put:record=>{events.push(['put',record.id]);records.set(record.id,record);},getAll:()=>{const readRequest={};queueMicrotask(()=>{readRequest.result=[...records.values()];readRequest.onsuccess?.();});return readRequest;},delete:id=>{events.push(['delete',id]);records.delete(id);}})};queueMicrotask(()=>tx.oncomplete?.());return tx;}};request.result=db;queueMicrotask(()=>{request.onupgradeneeded?.({target:{result:db}});request.onsuccess?.();});return request;}};
}

test('campaign IndexedDB adapter keeps database/store contract and park-scoped reads',async()=>{
  const{window}=setup(),indexedDB=fakeIndexedDB(),store=window.DG_VALIDATION_CAMPAIGN_STORE_ADAPTER.create({getIndexedDB:()=>indexedDB});
  await store.save({id:'a',parkId:7});await store.save({id:'b',parkId:8});
  assert.deepEqual(JSON.parse(JSON.stringify(await store.load(7))),[{id:'a',parkId:7}]);assert.equal((await store.load(null)).length,2);
  assert.equal(await store.remove('a'),true);assert.deepEqual([...indexedDB.records.keys()],['b']);
  assert.ok(indexedDB.events.some(event=>JSON.stringify(event)==='["open","DendroGeoValidate",1]'));
  assert.ok(indexedDB.events.some(event=>JSON.stringify(event)==='["create","campaigns","id"]'));
  await assert.rejects(window.DG_VALIDATION_CAMPAIGN_STORE_ADAPTER.create({getIndexedDB:()=>null}).open(),/IndexedDB yok/);
});

test('archive application forwards campaign save, scoped list and delete through the adapter',async()=>{
  const{window}=setup(),calls=[],store={save:async value=>{calls.push(['save',value]);return true;},load:async value=>{calls.push(['load',value]);return[];},remove:async value=>{calls.push(['remove',value]);return true;}},archive=window.DG_VALIDATION_CAMPAIGN_ARCHIVE.create({store}),campaign={id:'c1'};
  assert.equal(await archive.saveCampaign(campaign),true);await archive.loadCampaigns('park-1');assert.equal(await archive.deleteCampaign('c1'),true);
  assert.deepEqual(calls.map(call=>call[0]),['save','load','remove']);assert.equal(calls[0][1],campaign);assert.equal(calls[1][1],'park-1');
});

test('lc-validate service facade delegates campaign CRUD to the IndexedDB adapter',async()=>{
  const indexedDB=fakeIndexedDB(),{window,context}=setup({indexedDB});vm.runInContext(read('src/services/lc-validate.js'),context,{filename:'src/services/lc-validate.js'});
  const api=window.DG_LC_VALIDATE,campaign={id:'park-7',parkId:7,owner:'owner'};
  assert.equal(await api.saveCampaign(campaign),true);assert.deepEqual(JSON.parse(JSON.stringify(await api.loadCampaigns(7))),[campaign]);
  assert.deepEqual(JSON.parse(JSON.stringify(await api.loadCampaigns(8))),[]);assert.equal(await api.deleteCampaign('park-7'),true);assert.equal((await api.loadCampaigns(null)).length,0);
});

test('save queue serializes writes and continues after a rejected write',async()=>{
  const{window}=setup(),queue=window.DG_VALIDATION_CAMPAIGN_SAVE_QUEUE.create(),events=[];
  const first=queue.enqueue(async()=>{events.push('first-start');await Promise.resolve();events.push('first-fail');throw Error('disk');});
  const second=queue.enqueue(()=>{events.push('second-start');return true;});
  await assert.rejects(first,/disk/);assert.equal(await second,true);assert.deepEqual(events,['first-start','first-fail','second-start']);
});

test('save failure updates only the current campaign and never replaces a newer record message',()=>{
  const{window}=setup(),events=[],handle=window.DG_HANDLE_VALIDATION_CAMPAIGN_SAVE_FAILURE.handle;
  const ports={currentId:()=> 'campaign-a',setStatus:value=>events.push(['status',value]),translate:value=>'tr:'+value,updateStatus:()=>events.push('update')};
  assert.equal(handle('campaign-b',ports),false);assert.deepEqual(events,[]);
  assert.equal(handle('campaign-a',ports),true);assert.equal(events[0][1],'tr:Cihaz kaydı başarısız. Kaydet düğmesiyle hesap kaydını deneyin.');assert.equal(events[1],'update');
});

test('campaign selector enforces owner and fingerprint when migrating the legacy device draft',()=>{
  const{window}=setup(),select=window.DG_SELECT_VALIDATION_CAMPAIGN.select,expected={id:'surface-owner-park-7',owner:'owner',parkId:7,parkName:'Park',fingerprint:'f'};
  const current={...expected,modifiedAt:'new'},legacy={id:'surface-owner-x',owner:'owner',fingerprint:'f',modifiedAt:'old'};
  assert.equal(select([current,legacy],expected),current);
  assert.deepEqual(JSON.parse(JSON.stringify(select([legacy],expected))),{...legacy,id:expected.id,parkId:7,parkName:'Park'});
  assert.equal(select([{...legacy,owner:'other'}],expected),null);assert.equal(select([{...legacy,fingerprint:'stale'}],expected),null);
});

test('validation campaign modules load before lc-validate, are precached and back service/UI delegation',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),service=read('src/services/lc-validate.js'),ui=read('src/ui/lc-sens.js'),serviceIndex=chain.indexOf('"src/services/lc-validate.js"'),uiIndex=chain.indexOf('"src/ui/lc-sens.js"');
  for(const path of modules){const index=chain.indexOf('"'+path+'"');assert.ok(index>=0&&index<serviceIndex,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(service.includes('DG_VAL_CAMPAIGN_ARCHIVE.saveCampaign(campaign)'));assert.ok(service.includes('async function dgValSaveCampaign(campaign)'));
  assert.ok(ui.includes('DG_VALIDATION_CAMPAIGN_SAVE_QUEUE.create()'));assert.ok(ui.includes('DG_SELECT_VALIDATION_CAMPAIGN.select'));
  assert.ok(chain.indexOf('"src/ui/lc-sens.js"')===uiIndex&&uiIndex>serviceIndex);
});
