import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/ui/show-measurement-validation-error.js',
  'src/ui/reset-measurement-entry-fields.js',
  'src/ui/confirm-measurement-project-delete.js',
  'src/adapters/trees/measurement-project-deletion-store.js',
  'src/application/trees/delete-measurement-project.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('validation error focuses the field, marks it invalid, then notifies',()=>{
  const{window}=setup(),events=[],field={setAttribute:(...args)=>events.push(['attribute',...args]),focus:()=>events.push('focus')};
  window.DG_SHOW_MEASUREMENT_VALIDATION_ERROR.show({fieldId:'mPoint',message:'Point required',element:id=>{assert.equal(id,'mPoint');return field;},notify:(...args)=>events.push(['notify',...args])});
  assert.deepEqual(events,[['attribute','aria-invalid','true'],'focus',['notify','Point required','err']]);
});

test('measurement reset clears only per-tree fields and preserves helper order',()=>{
  const{window}=setup(),events=[],elements=Object.fromEntries(['mPoint','mDbh','mHeight','pointQueryResult'].map(id=>[id,{value:'x',style:{display:'block'}}]));
  window.DG_RESET_MEASUREMENT_ENTRY_FIELDS.reset({element:id=>elements[id],clearPhoto:()=>events.push('photo'),setManualPoint:value=>events.push(['manual',value]),liveCalc:()=>events.push('calc')});
  assert.equal(elements.mPoint.value,'');assert.equal(elements.mDbh.value,'');assert.equal(elements.mHeight.value,'');assert.equal(elements.pointQueryResult.style.display,'none');assert.deepEqual(events,['photo',['manual',false],'calc']);
});

test('delete confirmation retains count-aware Turkish warning',()=>{
  const{window}=setup(),messages=[];
  const result=window.DG_CONFIRM_MEASUREMENT_PROJECT_DELETE.confirm({count:12,format:(text,data)=>text.replace('{n}',data.n),confirm:text=>{messages.push(text);return false;}});
  assert.equal(result,false);assert.match(messages[0],/12 ölçüm/);assert.match(messages[0],/Park kimliği silinmez/);assert.match(messages[0],/ölçüm noktaları/);
});

test('project deletion adapter preserves measurement count and waypoint-before-project RLS writes',async()=>{
  const{window}=setup(),calls=[],client={from:table=>({select:(columns,options)=>({eq:(field,value)=>{calls.push(['count',table,columns,options,field,value]);return Promise.resolve({count:12});}}),delete:()=>({eq:async(field,value)=>{calls.push(['delete',table,field,value]);return{error:null};}})})};
  const store=window.DG_MEASUREMENT_PROJECT_DELETION_STORE;
  assert.equal(await store.countMeasurements({client,projectId:5}),12);await store.delete({client,projectId:5});
  assert.equal(JSON.stringify(calls),JSON.stringify([['count','measurements','*',{count:'exact',head:true},'project_id',5],['delete','waypoints','project_id',5],['delete','projects','id',5]]));
});

test('delete use case skips writes on cancel and refreshes only after success',async()=>{
  const{window}=setup(),events=[],ports={count:async id=>{events.push(['count',id]);return 3;},confirm:count=>{events.push(['confirm',count]);return false;},delete:async id=>events.push(['delete',id]),refresh:()=>events.push('refresh')};
  assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_DELETE_MEASUREMENT_PROJECT.remove(5,ports))),{deleted:false});assert.equal(events.some(event=>Array.isArray(event)&&event[0]==='delete'),false);
  events.length=0;assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_DELETE_MEASUREMENT_PROJECT.remove(5,{...ports,confirm:()=>true}))),{deleted:true});assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['count','delete','refresh']);
});

test('five cleanup modules load before measure.js, are precached and delegated',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js'),source=read('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  for(const token of ['DG_SHOW_MEASUREMENT_VALIDATION_ERROR','DG_RESET_MEASUREMENT_ENTRY_FIELDS','DG_CONFIRM_MEASUREMENT_PROJECT_DELETE','DG_MEASUREMENT_PROJECT_DELETION_STORE','DG_DELETE_MEASUREMENT_PROJECT'])assert.ok(source.includes(token),token);
});
