import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('park planning works without a project and isolates parks/accounts without persistence writes',async()=>{
 const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/ui/park-waypoint-workspace.js',import.meta.url),'utf8'),c);
 let key='account-a:park-1',options,removed=0;const workspace=c.window.DG_PARK_WAYPOINT_WORKSPACE_UI.create({key:()=>key,canInteract:()=>true,render:input=>{options=input;return{dgDispose(){},dgMountControls(){}};},removeLayer:()=>removed++,grid:()=>({cells:[{id:1,lat:1,lon:2}],selection:new Set([1]),current:true}),selectCells:cells=>cells,buildRows:(cells,n)=>cells.map(cell=>({...cell,wp_id:n++,visited:false}))});
 workspace.mount();assert.equal(options.editable,true);const row=await options.onCreate({lat:1,lon:2});options.rows.push(row);assert.equal(workspace.rows().length,1);assert.equal(row.project_id,undefined);
 const oldSave=options.onSave;key='account-a:park-2';workspace.mount();assert.equal(workspace.rows().length,0);await assert.rejects(oldSave({id:row.id,wpId:2}),/Park değişti/);
 assert.equal(workspace.addGrid('auto'),1);assert.equal(workspace.rows().length,1);
 key='account-b:park-1';workspace.mount();assert.equal(workspace.rows().length,0);
 key='account-a:park-1';workspace.mount();assert.equal(workspace.rows()[0],row);workspace.suspend();assert.equal(workspace.rows().length,0);assert.ok(removed>=3);
});
