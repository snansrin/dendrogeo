import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/link-project.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_LINK_PROJECT_APPLICATION.create;
function setup(overrides={}){
  const calls=[];
  const useCase=create({
    isAdmin:()=>true,getPark:()=>({id:7,name:'Göksu Parkı'}),
    getProject:()=>({id:3,name:'Kuzey Kesim Envanteri',park_id:null}),getLabel:()=>'',
    labelFromLegacy:(name,park)=>name===park?'':name,
    updateProject:async(pid,patch)=>{calls.push(['update',pid,patch]);return{data:{id:pid,name:'Göksu Parkı - Kuzey Kesim Envanteri'},error:null};},
    backfillMeasurements:async(pid,park)=>calls.push(['measurements',pid,park]),...overrides
  });
  return{useCase,calls};
}

test('admin link preserves an old project name as its label and backfills measurements',async()=>{
  const a=setup();const result=await a.useCase(3);
  assert.equal(result.status,'linked');
  assert.deepEqual(JSON.parse(JSON.stringify(a.calls)),[
    ['update',3,{park_id:7,label:'Kuzey Kesim Envanteri'}],['measurements',3,7]
  ]);
});

test('a non-admin is stopped before project or database access',async()=>{
  let projectReads=0,writes=0;
  const a=setup({isAdmin:()=>false,getProject:()=>{projectReads++;return null;},updateProject:async()=>{writes++;}});
  assert.equal((await a.useCase(3)).status,'forbidden');
  assert.equal(projectReads,0);assert.equal(writes,0);
});

test('empty label on an already linked project remains an intentional rename',async()=>{
  const a=setup({getProject:()=>({id:3,name:'Göksu Parkı - eski',park_id:7})});
  await a.useCase(3);
  assert.deepEqual(JSON.parse(JSON.stringify(a.calls[0])),['update',3,{park_id:7,label:''}]);
});

test('write errors stop measurement backfill',async()=>{
  const error={message:'denied'};const a=setup({updateProject:async()=>({data:null,error})});
  const result=await a.useCase(3);
  assert.equal(result.status,'write-failed');assert.equal(result.error,error);assert.equal(a.calls.length,0);
});

test('measurement backfill failure does not undo an accepted project link',async()=>{
  const a=setup({backfillMeasurements:async()=>{throw Error('backfill unavailable');}});
  assert.equal((await a.useCase(3)).status,'linked');
});
