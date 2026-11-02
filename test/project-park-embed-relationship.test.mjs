import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('every direct or nested projects park embed names the canonical foreign key',()=>{
 for(const file of ['src/adapters/trees/fetch-owned-measurement-projects.js','src/adapters/trees/fetch-shared-measurement-projects.js','src/adapters/export/shared-park-inventory-store.js','src/adapters/admin/admin-tree-store.js']){
  const source=read(file);
  assert.match(source,/parks!projects_park_id_fkey\(/,file);
  assert.doesNotMatch(source,/parks\(/,file+' must not depend on a unique inferred relationship');
 }
});

test('owned project adapter succeeds without fallback against role-visible ambiguous relationships',async()=>{
 const window={},selects=[];vm.runInNewContext(read('src/adapters/trees/fetch-owned-measurement-projects.js'),{window});
 const client={from(){return{select(columns){selects.push(columns);return{eq:async()=>columns.includes('parks!projects_park_id_fkey(')?{data:[{id:10,park_id:7,parks:{id:7,name:'Own Park'}}]}:{error:{code:'PGRST201',message:'more than one relationship'}}};}};}};
 const rows=await window.DG_OWNED_MEASUREMENT_PROJECTS.fetch({client,userId:'member',onRelationError(){throw Error('canonical relationship should not need fallback');}});
 assert.equal(rows[0].parks.id,7);assert.equal(selects.length,1);
});

test('admin measurement listing retains nested park data instead of falling back on PGRST201',async()=>{
 const window={},selections=[];vm.runInNewContext(read('src/adapters/admin/admin-tree-store.js'),{window});
 const client={from(table){return{select(columns){selections.push({table,columns});return this;},order(){return this;},limit:async()=>({data:[{id:1,projects:{id:10,parks:{id:7,name:'Own Park'}}}],count:1,error:selections.at(-1).columns.includes('parks!projects_park_id_fkey(')?null:{code:'PGRST201',message:'ambiguous'}})};}};
 const result=await window.DG_ADMIN_TREE_STORE.fetchRows(client,()=>{});
 assert.equal(result.mode,'embed');assert.equal(result.rows[0].projects.parks.id,7);assert.equal(selections.length,1);
});
