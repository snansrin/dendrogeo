import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/project-link-store.js',import.meta.url),'utf8'),context);

test('project link store updates the project and fills missing measurement park ids',async()=>{
  const calls=[];let table='';
  const query={
    update(patch){calls.push(['update',table,patch]);return this;},
    eq(key,value){calls.push(['eq',table,key,value]);return this;},
    is(key,value){calls.push(['is',table,key,value]);return this;},
    select(){calls.push(['select',table]);return this;},
    async single(){return{data:{id:3,name:'Göksu Parkı - eski'},error:null};}
  };
  const store=context.window.DG_PARK_PROJECT_LINK_STORE_ADAPTER.create({getClient:()=>({from(name){table=name;calls.push(['from',name]);return query;}})});
  const result=await store.updateProject(3,{park_id:7,label:'eski'});
  assert.equal(result.data.id,3);
  await store.backfillMeasurements(3,7);
  assert.deepEqual(calls.map(x=>x[0]),['from','update','eq','select','from','update','eq','is']);
  assert.equal(calls[1][1],'projects');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1][2])),{park_id:7,label:'eski'});
  assert.equal(calls[5][1],'measurements');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[5][2])),{park_id:7});
});
