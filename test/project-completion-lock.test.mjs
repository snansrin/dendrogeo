import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('a locked project is never restored as a field-work target',()=>{
 const window={};vm.runInNewContext(read('src/adapters/trees/project-selection-memory.js'),{window});
 const storage={getItem:()=>"12"};
 assert.equal(window.DG_PROJECT_SELECTION_MEMORY.restore(storage,'last',[{id:12,is_locked:true}]),null);
 assert.equal(window.DG_PROJECT_SELECTION_MEMORY.restore(storage,'last',[{id:12,is_locked:false}]),'12');
});

test('typed completion label and disabled measurement option use project identity',()=>{
 const window={};vm.runInNewContext(read('src/ui/render-measurement-project-directory.js'),{window,WeakSet,WeakMap});
 const elements={mProject:{},nProject:{}};
 window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects:[{id:12,name:'Göksu 2026',is_locked:true,shared:false},{id:13,name:'Göksu 2027',shared:false}],element:id=>elements[id]||null,escape:value=>String(value),optionLabel:row=>row.name,restore:()=>{},renderCard:()=>'',editing:false,actions:{}});
 assert.match(elements.mProject.innerHTML,/value="12" disabled data-locked="true"/);
 assert.match(elements.mProject.innerHTML,/value="13"/);
 assert.doesNotMatch(elements.mProject.innerHTML,/value="13" disabled/);
});

test('locked project rejects a measurement before scientific calculation',()=>{
 const window={};const projects=[{id:12,is_locked:true}];
 vm.runInNewContext(read('src/ui/validate-measurement-save-form.js'),{window,PROJ_LIST:projects});
 const fields=Object.fromEntries(['mProject','mPoint','mNo','mGroup','mSpecies','mDbh','mHeight'].map(id=>[id,{setAttribute:()=>{}}]));
 const result=window.DG_VALIDATE_MEASUREMENT_SAVE_FORM.validate({form:{projectId:12},element:id=>fields[id],validator:{validateNewMeasurement:()=>{throw Error('calculation gate should never be reached');}}});
 assert.equal(result.valid,false);assert.equal(result.reason,'project-locked');
});

test('database migration checks old and new project identities and prohibits locked deletes',()=>{
 const sql=read('supabase/migrations/20261031120000_project_completion_lock.sql');
 for(const token of ['is_locked boolean not null default false','dg_project_completion_guard','dg_measurement_completion_guard','dg_waypoint_completion_guard','OLD.project_id','NEW.project_id','PROJECT_LOCKED','auth.uid()'])assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/update public\.measurements set|delete from public\.measurements/);
});

test('locked moderation rows are read-only in both admin presentations',()=>{
 const window={};vm.runInNewContext(read('src/ui/admin-tree-measurement-row.js'),{window});
 vm.runInNewContext(read('src/ui/admin-measurement-row.js'),{window});
 const row={id:2,status:'Beklemede',point_id:1,projects:{is_locked:true},carbon_kg:1,profiles:{full_name:'A'}};
 const ports={escape:String,latin:{},thumbnail:()=>'',badge:String};
 const tree=window.DG_ADMIN_TREE_MEASUREMENT_ROW.render(row,ports);
 const flat=window.DG_ADMIN_MEASUREMENT_ROW_UI.render(row,ports);
 for(const html of [tree,flat]){
  assert.match(html,/Salt okunur/);
  assert.doesNotMatch(html,/data-admin-measurement-action="delete"/);
  assert.doesNotMatch(html,/data-admin-measurement-action="approve"/);
 }
});
