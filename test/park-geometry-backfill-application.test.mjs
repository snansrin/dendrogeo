import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/backfill-park-geometry.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_GEOMETRY_BACKFILL_APPLICATION.create;
const park={id:7,name:'Göksu',osm_key:'way/88',area_m2:1200};

function setup(overrides={}){
  const events=[];
  const operation=create({
    isAdmin:()=>true,
    getPark:async id=>id===7?park:null,
    fetchRing:async key=>{events.push(`fetch:${key}`);return{outer:[[[39,32],[39,33],[40,33],[39,32]]],inner:[]};},
    calculateArea:()=>1549.7,
    saveGeometry:async(id,update)=>{events.push(`save:${id}:${update.area_m2}`);return{error:null};},
    notify:(kind)=>events.push(kind),
    onComplete:()=>events.push('complete'),
    ...overrides
  });
  return{operation,events};
}

test('geometry backfill checks access, fetches, rounds area, saves, then refreshes',async()=>{
  const{operation,events}=setup();
  const result=await operation(7);
  assert.equal(result.status,'saved');
  assert.equal(result.areaM2,1550);
  assert.deepEqual(events,['loading','fetch:way/88','save:7:1550','saved','complete']);
});

test('authorization, missing park, OSM failures, and missing boundaries stop before writing',async()=>{
  const denied=setup({isAdmin:()=>false});
  assert.equal((await denied.operation(7)).status,'forbidden');
  assert.deepEqual(denied.events,[]);
  assert.equal((await setup({getPark:async()=>null}).operation(7)).status,'park-not-found');
  const failed=setup({fetchRing:async()=>{throw Error('offline');}});
  assert.equal((await failed.operation(7)).status,'osm-error');
  assert.deepEqual(failed.events,['loading','osm-error']);
  const missing=setup({fetchRing:async()=>null});
  assert.equal((await missing.operation(7)).status,'boundary-not-found');
  assert.deepEqual(missing.events,['loading','boundary-not-found']);
});

test('write errors retain the park area and never refresh the admin list',async()=>{
  const failure={message:'RLS'};
  const{operation,events}=setup({calculateArea:()=>0,saveGeometry:async(id,update)=>{events.push(`save:${update.area_m2}`);return{error:failure};}});
  const result=await operation(7);
  assert.equal(result.status,'write-error');
  assert.equal(result.error,failure);
  assert.deepEqual(events,['loading','fetch:way/88','save:1200','write-error']);
});
