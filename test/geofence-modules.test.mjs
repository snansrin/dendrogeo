import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const MODULES=[
  'src/domain/parks/distance-to-park-boundary.js',
  'src/domain/parks/decide-park-geofence.js',
  'src/adapters/parks/read-fresh-gps-fix.js',
  'src/domain/parks/stamp-geofence-decision.js',
  'src/application/parks/verify-at-park.js',
];

function loadGeofence(){
  const context=vm.createContext({
    window:null,navigator:null,sb:{},console:{warn(){},log(){},error(){}},
    pointToSegmentDistanceM:(lat,lon,a,b)=>Math.abs(lat-a[0])*111_000,
    pointInPark:(lat,lon)=>lat>=0&&lat<=1&&lon>=0&&lon<=1,
    hav:()=>25,
  });
  context.window=context;
  for(const path of MODULES)vm.runInContext(read(path),context,{filename:path});
  context.DG_PARK_GEOMETRY_STORE_ADAPTER={create:()=>({updateGeometry:async()=>({data:null,error:null})})};
  context.DG_PARK_GEOMETRY_APPLICATION={create:()=>async park=>park};
  vm.runInContext(read('src/services/geofence.js'),context,{filename:'src/services/geofence.js'});
  return context;
}

test('locked geofence service delegates boundary decisions to five additive modules',()=>{
  const ctx=loadGeofence();
  const park={name:'Park',centroid_lat:.5,centroid_lon:.5,geom_json:{outer:[[[0,0],[0,1],[1,1],[1,0]]]}};
  assert.equal(ctx.dgDistToParkM(0.0001,0.5,park.geom_json),11.1);
  assert.equal(ctx.dgGeoDecide({lat:.5,lon:.5,acc:5},park).reason,'inside');
  assert.equal(ctx.dgGeoDecide({lat:-.00018,lon:.5,acc:5},park).reason,'margin');
  assert.equal(ctx.dgGeoDecide({lat:.5,lon:.5,acc:120},park).reason,'acc');
});

test('fresh GPS adapter preserves high accuracy, timeout, age, and result shape',async()=>{
  const ctx=loadGeofence();
  let options;
  ctx.navigator={geolocation:{getCurrentPosition(ok,_fail,opts){options=opts;ok({coords:{latitude:.2,longitude:.3,accuracy:8}});}}};
  const fix=await ctx.dgFreshFix(30);
  assert.equal(fix.lat,.2);assert.equal(fix.lon,.3);assert.equal(fix.acc,8);assert.ok(Number.isFinite(fix.at));
  assert.deepEqual(JSON.parse(JSON.stringify(options)),{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
});

test('verification application preserves no-sensor soft pass and denied hard block',async()=>{
  const ctx=loadGeofence();
  const park={name:'Park'};
  const noSensor=await ctx.dgVerifyAtPark(park,'project');
  assert.equal(noSensor.ok,true);assert.equal(noSensor.verified,false);assert.equal(noSensor.reason,'no-geo');
  ctx.navigator={geolocation:{getCurrentPosition(_ok,fail){fail({code:1,message:'izin yok'});}}};
  const denied=await ctx.dgVerifyAtPark(park,'project');
  assert.equal(denied.ok,false);assert.equal(denied.reason,'denied');assert.match(denied.message,/Konum izni gerekli/);
});

test('audit stamp keeps the payload identity and only stamps verified decisions',()=>{
  const ctx=loadGeofence();
  const base={value:1};
  const stamped=ctx.dgGeoStamp(base,{fix:{},acc:4.6,distM:12,verified:true});
  assert.equal(stamped,base);assert.equal(base.geo_acc_m,5);assert.equal(base.geo_dist_m,12);assert.ok(base.geo_verified_at);
  const unchecked={};
  ctx.dgGeoStamp(unchecked,{fix:{},acc:null,distM:null,verified:false});
  assert.equal(Object.hasOwn(unchecked,'geo_verified_at'),false);
});
