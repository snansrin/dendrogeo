import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/create-manual-park.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_MANUAL_CREATION_APPLICATION.create;
function setup(overrides={}){
  const calls=[];
  const run=create({getName:()=> ' Yeni Koru ',getAreaHectares:()=> '12,5',getLocation:()=>({lat:40.1,lon:33.2}),registerPark:async(...args)=>{calls.push(args);return{id:17,name:'Yeni Koru'};},...overrides});
  return{run,calls};
}

test('valid manual input converts hectares to square meters and registers at the chosen point',async()=>{
  const a=setup();const result=await a.run();
  assert.equal(result.status,'created');assert.equal(result.row.id,17);
  assert.deepEqual(JSON.parse(JSON.stringify(a.calls[0])),[
    [{name:'Yeni Koru',source:'manual',area:125000},{manual:true,lat:40.1,lon:33.2}]
  ][0]);
});

test('empty name and missing latitude stop before registration',async()=>{
  const noName=setup({getName:()=>''});assert.equal((await noName.run()).status,'name-required');assert.equal(noName.calls.length,0);
  const noPoint=setup({getLocation:()=>({lon:33})});assert.equal((await noPoint.run()).status,'location-required');assert.equal(noPoint.calls.length,0);
});

test('invalid or non-positive area is stored as unknown; registration failure is reported',async()=>{
  const unknown=setup({getAreaHectares:()=>'-2'});await unknown.run();
  assert.equal(unknown.calls[0][0].area,null);
  const failed=setup({registerPark:async()=>null});assert.equal((await failed.run()).status,'registration-failed');
});
