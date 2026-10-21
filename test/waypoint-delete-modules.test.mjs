import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/is-waypoint-project-selected.js',
  'src/ui/confirm-waypoint-list-deletion.js',
  'src/adapters/map/delete-project-waypoints.js',
  'src/application/map/clear-deleted-waypoint-list.js',
  'src/application/map/delete-project-waypoints.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('project gate rejects an empty selection and accepts a project ID',()=>{
  const selected=setup().DG_IS_WAYPOINT_PROJECT_SELECTED.isSelected;
  assert.equal(selected(0),false);assert.equal(selected(null),false);assert.equal(selected(14),true);
});

test('confirmation preserves the exact translated permanent-delete warning',()=>{
  const confirmDeletion=setup().DG_CONFIRM_WAYPOINT_LIST_DELETION.confirm,events=[];
  assert.equal(confirmDeletion({confirm:message=>{events.push(message);return true;},translate:value=>`EN:${value}`}),true);
  assert.deepEqual(events,["EN:⚠ Bu projedeki TÜM ölçüm noktaları kalıcı olarak silinsin mi? Yanlış liste ise sonra yeniden yükleyebilirsiniz."]);
});

test('delete adapter preserves project_id-only Supabase filtering and response identity',async()=>{
  const remove=setup().DG_DELETE_PROJECT_WAYPOINTS.delete,events=[],response={error:null};
  const client={from:table=>({delete:()=>({eq:async(...args)=>{events.push([table,...args]);return response;}})})};
  assert.equal(await remove({client,projectId:14}),response);assert.deepEqual(events,[['waypoints','project_id',14]]);
});

test('successful clearing resets target/list, notifies, then reloads in order',()=>{
  const clear=setup().DG_CLEAR_DELETED_WAYPOINT_LIST.clear,events=[];
  clear({setTarget:value=>events.push(['target',value]),setWaypoints:value=>events.push(['waypoints',value]),notify:message=>events.push(['notify',message]),refresh:()=>events.push('refresh')});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['target',null],['waypoints',[]],['notify','✓ Liste tamamen silindi. Yeni CSV yükleyebilirsiniz.'],'refresh']);
});

test('use case handles missing project, cancellation, delete error and success safely',async()=>{
  const execute=setup().DG_DELETE_PROJECT_WAYPOINTS_USE_CASE.execute,events=[];
  const base={projectId:14,isSelected:()=>true,confirmDeletion:()=>true,remove:async id=>{events.push(['delete',id]);return{error:null};},showError:error=>events.push(['error',error.message]),complete:()=>events.push('complete'),notify:(...args)=>events.push(['notify',...args])};
  await execute({...base,projectId:0,isSelected:()=>false});assert.deepEqual(JSON.parse(JSON.stringify(events)),[['notify','Proje seç']]);events.length=0;
  await execute({...base,confirmDeletion:()=>false});assert.deepEqual(events,[]);
  await execute({...base,remove:async id=>{events.push(['delete',id]);return{error:{message:'RLS'}};}});assert.deepEqual(JSON.parse(JSON.stringify(events)),[['delete',14],['error','RLS']]);events.length=0;
  await execute(base);assert.deepEqual(JSON.parse(JSON.stringify(events)),[['delete',14],'complete']);
});

test('delete modules are loaded before map service and offline-pre-cached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'));}
  assert.match(service,/DG_DELETE_PROJECT_WAYPOINTS_USE_CASE/);assert.match(service,/DG_DELETE_PROJECT_WAYPOINTS\.delete\(\{client:sb,projectId:pid\}\)/);
});
