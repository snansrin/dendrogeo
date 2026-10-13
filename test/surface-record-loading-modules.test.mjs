import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/create-surface-review-record.js','src/application/surface/load-local-surface-review-draft.js','src/domain/surface/select-surface-review-source.js','src/domain/surface/normalize-surface-review-record.js','src/application/surface/load-surface-review-record.js'];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}
const validResult=()=>({schema:'dendrogeo-surface/2',parkId:7,fingerprint:'fp',areas:{green:100},features:[],displayFeatures:[]});

test('new review record keeps the established park, engine and sensitivity defaults',()=>{
 const create=setup().DG_CREATE_SURFACE_REVIEW_RECORD.create,record=create({park:{id:7,name:'Park'},owner:'owner',createdAt:'now'});
 assert.equal(record.id,'surface-owner-7');assert.equal(record.owner,'owner');assert.equal(record.parkName,'Park');assert.deepEqual(JSON.parse(JSON.stringify(record.sens)),{green:50,water:50,hard:50,bare:50});assert.equal(record.analysisEngine,'esa-raster-manual-v1');assert.equal(record.period,'ytd');assert.deepEqual(JSON.parse(JSON.stringify(record.corrections)),{});assert.deepEqual(JSON.parse(JSON.stringify(record.features)),[]);
});

test('local draft lookup prefers the scoped record and migrates only matching legacy drafts',async()=>{
 const load=setup().DG_LOAD_LOCAL_SURFACE_REVIEW_DRAFT.load,fresh={id:'surface-owner-7',owner:'owner',parkId:7,parkName:'Park'},current={...fresh,modifiedAt:'today'},calls=[];
 assert.equal(await load({fresh,loadCampaigns:async park=>{calls.push(park);return park===7?[current]:[];},selectCampaign:{select:rows=>rows[0]},fingerprint:async()=>{throw Error('not needed');}}),current);assert.deepEqual(calls,[7]);
 const legacy={id:'surface-owner-x',owner:'owner',fingerprint:'fp'};calls.length=0;
 const migrated=await load({fresh,loadCampaigns:async park=>{calls.push(park);return park===null?[legacy]:[];},selectCampaign:{select:(rows,expected)=>rows.find(row=>row.id==='surface-owner-x'&&row.fingerprint===expected.fingerprint)?{...legacy,id:expected.id,parkId:expected.parkId,parkName:expected.parkName}:null},fingerprint:async()=> 'fp',cells:[],outer:[],holes:[],year:2021,engine:'v'});
 assert.equal(migrated.id,fresh.id);assert.equal(migrated.parkId,7);assert.deepEqual(calls,[7,null]);
 assert.equal(await load({fresh,loadCampaigns:async()=>{throw Error('offline');},fingerprint:async()=> 'fp'}),null);
});

test('account snapshot wins unless a newer dirty device draft belongs to the same park',()=>{
 const select=setup().DG_SELECT_SURFACE_REVIEW_SOURCE.select,fresh={owner:'owner',parkId:7},remote={owner:'owner',parkId:7,modifiedAt:'2026-10-12'},local={owner:'owner',parkId:7,draftDirty:true,modifiedAt:'2026-10-13'};
 assert.equal(select({fresh,local,remote}).record,local);assert.equal(select({fresh,local:{...local,draftDirty:false},remote}).record,remote);assert.equal(select({fresh,local:{...local,parkId:8},remote:null}).record,fresh);
});

test('record normalization clamps values, filters features and invalidates inconsistent accepted results',()=>{
 const normalize=setup().DG_NORMALIZE_SURFACE_REVIEW_RECORD.normalize,fresh={owner:'owner',parkId:7,sens:{green:50,water:50,hard:50,bare:50}},source={...fresh,fingerprint:'fp',sens:{green:-3,water:140,hard:'bad',bare:22},corrections:[],features:[{valid:true},{valid:false}],acceptedAreas:{green:100},acceptedResult:validResult()};
 const clean=normalize({fresh,source,revision:4,classes:['green','water','hard','bare'],validFeature:feature=>feature.valid});
 assert.deepEqual(JSON.parse(JSON.stringify(clean.record.sens)),{green:0,water:100,hard:50,bare:22});assert.deepEqual(JSON.parse(JSON.stringify(clean.record.corrections)),{});assert.equal(clean.record.features.length,1);assert.equal(clean.record.serverRevision,4);assert.equal(clean.invalidAccepted,false);
 const invalid=normalize({fresh,source:{...source,acceptedResult:{...validResult(),areas:{green:101}}},revision:5,classes:['green','water','hard','bare'],validFeature:()=>true});
 assert.equal(invalid.record.acceptedResult,null);assert.equal(invalid.record.draftDirty,true);assert.equal(invalid.invalidAccepted,true);
});

test('load orchestration falls back after account errors and accepts a valid remote revision',async()=>{
 const window=setup(),load=window.DG_LOAD_SURFACE_REVIEW_RECORD.load,events=[],fresh={owner:'owner',parkId:7,sens:{green:50,water:50,hard:50,bare:50}},local={...fresh,draftDirty:true,modifiedAt:'later'};
 const ports={createFresh:()=>fresh,loadLocal:async record=>{assert.equal(record,fresh);return local;},loadRemote:async()=>{throw Error('offline');},selectSource:window.DG_SELECT_SURFACE_REVIEW_SOURCE.select,normalize:args=>window.DG_NORMALIZE_SURFACE_REVIEW_RECORD.normalize({...args,classes:['green','water','hard','bare'],validFeature:()=>true}),setStatus:value=>events.push(value),translate:value=>'tr:'+value};
 const fallback=await load(ports);assert.equal(fallback.modifiedAt,local.modifiedAt);assert.deepEqual(events,['tr:Hesap kaydı yüklenemedi; cihaz taslağı kullanılıyor.']);
 events.length=0;const remote={...fresh,modifiedAt:'older',fingerprint:'fp',acceptedAreas:{green:100},acceptedResult:validResult()};const result=await load({...ports,loadRemote:async()=>({payload:remote,revision:6,source_fingerprint:'fp'})});
 assert.equal(result.serverRevision,6);assert.equal(result.acceptedResult.schema,'dendrogeo-surface/2');assert.deepEqual(events,[]);
});

test('the five record-loading modules precede the locked UI and are precached',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}assert.match(ui,/DG_LOAD_SURFACE_REVIEW_RECORD/);assert.match(ui,/DG_CREATE_SURFACE_REVIEW_RECORD/);
});
