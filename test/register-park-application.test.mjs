import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/parks/identity.js',import.meta.url),'utf8'),context);
vm.runInContext(readFileSync(new URL('../src/application/parks/register-park.js',import.meta.url),'utf8'),context);
const identity=context.window.DG_PARK_IDENTITY;
const create=context.window.DG_PARK_REGISTRATION_APPLICATION.create;

function setup(overrides={}){
  const session=new Map(),calls={geocode:0,conflicts:[],failures:[],warnings:[]};
  const store={
    selectByKey:async()=>null,selectNear:async()=>null,
    insert:async row=>({data:{id:11,...row},error:null}),...overrides.store
  };
  const register=create({
    getStore:()=>store,getUser:()=>({id:'user-a'}),isEnabled:()=>true,session,
    centerFor:(_cand,opt)=>({lat:+opt.lat||null,lon:+opt.lon||null}),
    manualKey:identity.manualKey,osmKey:identity.osmKey,normalizeName:identity.normalizeName,
    matchRadius:identity.matchRadius,getReverseGeocode:()=>async()=>{calls.geocode++;return{city:'Ankara',country:'Türkiye'};},
    notifyManualConflict:row=>calls.conflicts.push(row),notifyWriteFailure:e=>calls.failures.push(e),warn:e=>calls.warnings.push(e),
    ...overrides.dependencies
  });
  return{register,session,calls,store};
}

test('registration resolves a nearby duplicate before geocoding or inserting and caches it',async()=>{
  const row={id:7,osm_key:'way/123',source:'osm'};
  let inserts=0;
  const a=setup({store:{selectNear:async()=>row,insert:async()=>{inserts++;}}});
  assert.equal(await a.register({name:'Göksu Parkı',type:'relation',id:5,area:500000},{lat:40,lon:29}),row);
  assert.equal(inserts,0);
  assert.equal(a.calls.geocode,0);
  assert.equal(a.session.get('relation/5'),row);
  assert.equal(await a.register({name:'other',type:'relation',id:5},{lat:40,lon:29}),row);
});

test('registration builds the established row and geocodes only missing place fields',async()=>{
  const a=setup();
  const row=await a.register({name:'İsimsiz',type:'way',id:9,area:1234.6},{lat:40,lon:29});
  assert.equal(row.id,11);
  assert.deepEqual(JSON.parse(JSON.stringify(row)),{
    id:11,osm_key:'way/9',osm_type:'way',osm_id:9,name:'İsimsiz',name_norm:'isimsiz',
    country:'Türkiye',city:'Ankara',centroid_lat:40,centroid_lon:29,area_m2:1235,
    source:'osm',created_by:'user-a'
  });
  assert.equal(a.calls.geocode,1);
  const known=setup();
  await known.register({name:'A',type:'way',id:10},{lat:40,lon:29,city:'İzmir',country:'Türkiye'});
  assert.equal(known.calls.geocode,0);
});

test('manual park identity and legacy no-user/schema gates remain intact',async()=>{
  const a=setup();
  const row=await a.register({name:'Göksu Parkı',source:'manual',area:10000},{manual:true,lat:40.1234,lon:29.9876});
  assert.equal(row.osm_key,'manual/goksu parki/40.123/29.988');
  assert.equal(row.osm_type,'manual');
  assert.equal(row.osm_id,null);
  const disabled=setup({dependencies:{getUser:()=>null}});
  assert.equal(await disabled.register({name:'A',type:'way',id:1},{}),null);
  const oldSchema=setup({dependencies:{isEnabled:()=>false}});
  assert.equal(await oldSchema.register({name:'A',type:'way',id:1},{}),null);
});

test('unique-key race rereads the canonical row; other write errors are reported',async()=>{
  const existing={id:12,osm_key:'way/14'};let reads=0;
  const race=setup({store:{selectByKey:async()=>++reads===1?null:existing,insert:async()=>({data:null,error:{code:'23505',message:'duplicate'}})}});
  assert.equal(await race.register({name:'A',type:'way',id:14},{lat:40,lon:29}),existing);
  assert.equal(race.session.get('way/14'),existing);
  assert.equal(race.calls.failures.length,0);
  const failure=Error('write denied');
  const broken=setup({store:{insert:async()=>({data:null,error:failure})}});
  assert.equal(await broken.register({name:'A',type:'way',id:15},{lat:40,lon:29}),null);
  assert.equal(broken.calls.warnings[0],failure);
  assert.equal(broken.calls.failures[0],failure);
});
