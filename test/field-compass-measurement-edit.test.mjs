import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const load=(paths,window={},globals={})=>{
  const context=vm.createContext({window,...globals});
  for(const path of paths)vm.runInContext(read(path),context,{filename:path});
  return window;
};

test('turning the phone rotates only the blue map arrow, not GPS position or red waypoint pins',()=>{
  const events={},arrow={style:{}},calls=[],now={value:10_000};
  const window=load([
    'src/ui/create-waypoint-gps-location-marker.js',
    'src/ui/render-waypoint-gps-guidance-readout.js'
  ],{
    screen:{orientation:{angle:0}},
    addEventListener:(name,callback)=>events[name]=callback,
    setTimeout:()=>1,clearTimeout:()=>{},
  },{Date:{now:()=>now.value}});
  const leaflet={
    divIcon:options=>options,
    marker:(coords,options)=>{
      calls.push(['marker',coords,options]);
      return {addTo(){return this;},getElement(){return {querySelector:()=>arrow}}};
    }
  };
  const gps={latitude:39.99,longitude:32.65};
  window.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER.add({map:{},gps,leaflet,target:{lat:40,lon:33},bearing:()=>270});
  const elements={navDist:{},navTarget:{},navArrow:{style:{}}};
  const ui=window.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT;
  ui.render({target:{wp_id:74,visited:false},meters:20,targetBearing:180,gps,
    getElement:id=>elements[id],translate:String});
  assert.equal(arrow.style.visibility,'hidden','no misleading target-pointing map arrow without compass');
  events.deviceorientation({webkitCompassHeading:90,webkitCompassAccuracy:3});
  assert.equal(arrow.style.visibility,'visible');
  assert.equal(arrow.style.transform,'rotate(90deg)');
  assert.equal(elements.navArrow.style.transform,'rotate(90deg)');
  events.deviceorientation({webkitCompassHeading:180,webkitCompassAccuracy:4});
  assert.equal(arrow.style.transform,'rotate(180deg)');
  assert.equal(elements.navArrow.style.transform,'rotate(0deg)');
  window.screen.orientation.angle=90;
  events.deviceorientation({webkitCompassHeading:180,webkitCompassAccuracy:4});
  assert.equal(arrow.style.transform,'rotate(270deg)');
  assert.equal(calls.length,1,'no marker redraws on orientation updates');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])),[39.99,32.65]);
  now.value=16_000;ui.render({target:{wp_id:74},meters:20,targetBearing:180,gps,
    getElement:id=>elements[id],translate:String});
  assert.equal(arrow.style.visibility,'hidden','stale compass data must hide the arrow');
});

test('species-only edit ignores volatile metadata but compares scientific and approval fields',async()=>{
  const window=load([
    'src/adapters/trees/update-measurement-if-current.js',
    'src/adapters/trees/persist-measurement-record.js'
  ]);
  const calls=[];
  const query={
    eq(field,value){calls.push(['eq',field,value]);return query;},
    is(field,value){calls.push(['is',field,value]);return query;},
    async select(){return {data:[{id:74}],error:null};}
  };
  const client={from(table){assert.equal(table,'measurements');return {
    update(record){calls.push(['update',record]);return query;}
  }}};
  const baseline={
    id:74,owner:'u',project_id:25,point_id:74,grp:'YAPRAKLI',
    species:'SÜS KİRAZI',girth_cm:75,dbh_cm:75/Math.PI,height_m:8,
    carbon_kg:200,status:'Onaylandı',deleted_at:null,
    updated_at:'2026-10-30T12:00:00Z',client_id:'old-client-id',
    background_metadata:{index:1},last_seen_at:'2026-10-30T12:02:00Z'
  };
  const result=await window.DG_PERSIST_MEASUREMENT_RECORD.persist({
    client,record:{owner:'u',species:'ZEYTİN',status:'Beklemede',client_id:'new-client-id'},
    editId:74,baseline
  });
  assert.equal(result.error,null);
  for(const field of ['id','owner','status','deleted_at','client_id'])
    assert.ok(calls.some(row=>row[1]===field),field);
  for(const field of ['updated_at','background_metadata','last_seen_at','species','girth_cm','dbh_cm','height_m'])
    assert.equal(calls.some(row=>row[1]===field),false,'volatile metadata must not block edit: '+field);
});

test('true edit collision and RLS errors remain blocked, never overwrite or insert a replacement',async()=>{
  const window=load([
    'src/adapters/trees/update-measurement-if-current.js',
    'src/adapters/trees/persist-measurement-record.js'
  ]);
  let count=0,write;
  const chain={
    eq(){return chain;},is(){return chain;},
    async select(){return ++count===1?{data:[],error:null}:{data:null,error:{code:'42501',message:'RLS denied'}};}
  };
  const client={from(table){assert.equal(table,'measurements');return {
    update(value){write=value;return chain;},
    insert(){throw Error('edit must never become INSERT');}
  }}};
  const input={client,record:{owner:'u',species:'İĞDE',client_id:'fresh-token'},editId:74,
    baseline:{id:74,owner:'u',client_id:'original-token',species:'ZEYTİN',status:'Onaylandı'}};
  const conflict=await window.DG_PERSIST_MEASUREMENT_RECORD.persist(input);
  assert.equal(conflict.error.code,'DG_EDIT_CONFLICT');
  const denied=await window.DG_PERSIST_MEASUREMENT_RECORD.persist(input);
  assert.equal(denied.error.code,'42501');
  assert.equal(write.species,'İĞDE');
});

test('approved owner can change species without an unrelated photo-metadata CAS rejection',async()=>{
  const window=load(['src/adapters/trees/update-measurement-if-current.js','src/adapters/trees/persist-measurement-record.js']);
  const server={id:74,owner:'u',client_id:'old-token',status:'Onaylı',deleted_at:null,
    project_id:25,point_id:74,measurement_no:1,grp:'YAPRAKLI',species:'SÜS KİRAZI',
    girth_cm:80,dbh_cm:80,height_m:9,photo_url:'new-photo.png',photo_file:'new.png'};
  const baseline={...server,photo_url:'old-photo.png',photo_file:'old.png'};
  let applied=false,attempts=0;
  const client={from(table){
    assert.equal(table,'measurements');
    return{update(payload){
      attempts++;const predicates=[];
      const query={
        eq(k,v){predicates.push([k,v]);return query;},
        is(k,v){predicates.push([k,v]);return query;},
        async select(){
          if(!predicates.every(([k,v])=>server[k]===v))return{data:[],error:null};
          Object.assign(server,payload);applied=true;return{data:[{id:74}],error:null};
        }
      };
      return query;
    }};
  }};
  const result=await window.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record:{
    owner:'u',species:'ZEYTİN',grp:'YAPRAKLI',carbon_kg:999,client_id:'new-token',status:'Beklemede'
  },editId:74,baseline});
  assert.equal(result.error,null);
  assert.equal(applied,true);
  assert.equal(attempts,1);
  assert.equal(server.photo_url,'new-photo.png','existing photo must not be overwritten');
  assert.equal(server.dbh_cm,80,'existing dimensions must not be overwritten');
});

test('stale edit token still prevents a write when the same row changed',async()=>{
  const window=load(['src/adapters/trees/update-measurement-if-current.js','src/adapters/trees/persist-measurement-record.js']);
  let writes=0;
  const server={id:74,owner:'u',client_id:'newer-token',status:'Onaylı',deleted_at:null,species:'SÜS KİRAZI'};
  const baseline={...server,client_id:'old-token'};
  const client={from(){
    return{update(payload){
      const filters=[];
      const query={eq(k,v){filters.push([k,v]);return query},is(k,v){filters.push([k,v]);return query},async select(){
        if(filters.every(([k,v])=>server[k]===v)){writes++;Object.assign(server,payload);return{data:[{id:74}],error:null}}
        return{data:[],error:null};
      }};
      return query;
    },select(){return{eq(){return this},maybeSingle:async()=>({data:server,error:null})}}};
  }};
  const result=await window.DG_PERSIST_MEASUREMENT_RECORD.persist({client,record:{owner:'u',species:'ZEYTİN',client_id:'another-token'},editId:74,baseline});
  assert.equal(result.error?.code,'DG_EDIT_CONFLICT');
  assert.match(result.error.message,/client_id/);
  assert.equal(writes,0);
});
