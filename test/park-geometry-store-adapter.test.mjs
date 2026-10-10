import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/park-geometry-store.js',import.meta.url),'utf8'),context);

test('park geometry adapter writes geom_json and returns the Supabase response unchanged',async()=>{
  const response={data:{id:7,geom_json:{outer:[],inner:[]}},error:null},calls=[];
  const query={
    update(value){calls.push(['update',value]);return this;},
    eq(key,value){calls.push(['eq',key,value]);return this;},
    select(){calls.push(['select']);return this;},
    async single(){calls.push(['single']);return response;}
  };
  const store=context.window.DG_PARK_GEOMETRY_STORE_ADAPTER.create({getClient:()=>({from(table){calls.push(['from',table]);return query;}})});
  const geometry={outer:[[[39,32],[39,33],[40,33]]],inner:[]};
  assert.equal(await store.updateGeometry(7,geometry),response);
  assert.deepEqual(calls.map(call=>call[0]),['from','update','eq','select','single']);
  assert.equal(calls[1][1].geom_json,geometry);
  assert.deepEqual(calls[2],['eq','id',7]);
});
