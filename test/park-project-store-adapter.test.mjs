import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/project-store.js',import.meta.url),'utf8'),context);

test('project store inserts through Supabase and returns its response unchanged',async()=>{
  const response={data:{id:19,name:'Göksu Parkı - batı'},error:null};
  const calls=[];
  const query={
    insert(row){calls.push(['insert',row]);return this;},
    select(){calls.push(['select']);return this;},
    async single(){calls.push(['single']);return response;}
  };
  const store=context.window.DG_PARK_PROJECT_STORE_ADAPTER.create({getClient:()=>({from(table){calls.push(['from',table]);return query;}})});
  const row={owner:'u1',park_id:7,label:'batı',name:'Göksu Parkı - batı',city:'Ankara',country:'Türkiye'};
  assert.equal(await store.insert(row),response);
  assert.deepEqual(calls.map(x=>x[0]),['from','insert','select','single']);
  assert.equal(calls[1][1],row);
});
