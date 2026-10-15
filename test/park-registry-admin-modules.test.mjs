import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const registry=read('src/services/park-registry.js');
const modules=[
  'src/ui/park-backfill-plan.js',
  'src/application/parks/park-admin-state.js',
  'src/adapters/parks/sync-park-project-names.js',
  'src/ui/render-park-admin.js',
  'src/application/parks/refresh-park-admin-views.js',
  'src/application/parks/toggle-park-admin-empty.js',
  'src/bootstrap/park-admin-controller.js',
  'src/bootstrap/park-backfill-controller.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('park admin store publishes frozen snapshots and removable subscriptions',()=>{
  const{window}=setup();const store=window.DG_PARK_ADMIN_STATE.create();const seen=[];
  const unsubscribe=store.subscribe(state=>seen.push(state));
  store.setState({rows:[{id:1}],showEmpty:true});
  assert.equal(Object.isFrozen(store.getState()),true);assert.equal(seen.length,1);assert.equal(seen[0].showEmpty,true);
  unsubscribe();store.setState({showEmpty:false});assert.equal(seen.length,1);
});

test('project-name adapter reads only when name is not supplied and keeps update scope',async()=>{
  const calls=[];let parkName='Göksu';const{window}=setup();
  const sync=window.DG_SYNC_PARK_PROJECT_NAMES_ADAPTER.create({getClient:()=>({from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},async maybeSingle(){calls.push('read');return{data:parkName?[{name:parkName}]:[]};},update(patch){calls.push(['update',patch]);return this;}};}})});
  await sync(8,'  Başkent  ');
  assert.equal(JSON.stringify(calls),JSON.stringify([['from','projects'],['update',{park_name:'Başkent'}],['eq','park_id',8]]));
  calls.length=0;await sync(9);
  assert.equal(JSON.stringify(calls),JSON.stringify([['from','parks'],['select','name'],['eq','id',9],'read',['from','projects'],['update',{park_name:'Göksu'}],['eq','park_id',9]]));
  calls.length=0;parkName='';await sync(10,'  ');assert.equal(JSON.stringify(calls),JSON.stringify([['from','parks'],['select','name'],['eq','id',10],'read']));
});

test('admin renderer records its context before building and rendering the current overview',()=>{
  const events=[];const{window}=setup();const state=window.DG_PARK_ADMIN_STATE.create({rows:[{id:2}],showEmpty:true});const box={};
  window.DG_RENDER_PARK_ADMIN_UI.render({state,element:id=>id==='parkAdminBox'?box:null,projects:[{id:4}],measurements:[],buildOverview:input=>{events.push(['build',input.showEmpty]);return{shown:input.rows};},renderRows:input=>events.push(['render',input.rows[0].id,input.showEmpty]),normalizeLoose:value=>value,normalizeName:value=>value,formatHectares:value=>value,distance:()=>0,escapeHTML:value=>value,translate:value=>value,translateFormat:value=>value,translatePlain:value=>value});
  assert.deepEqual(events,[['build',true],['render',2,true]]);assert.equal(state.getState().lastContext.projects[0].id,4);
});

test('admin refresh waits for park data, then refreshes secondary panels in order',async()=>{
  const events=[];const{window}=setup();
  await window.DG_REFRESH_PARK_ADMIN_VIEWS.refresh({loadParkAdmin:async()=>{events.push('park-start');await Promise.resolve();events.push('park-end');},loadProjects:()=>events.push('projects'),loadWorld:()=>events.push('world'),loadAdminTree:()=>events.push('tree')});
  assert.deepEqual(events,['park-start','park-end','projects','world','tree']);
});

test('empty-park toggle stores state and rerenders last known project/measurement context',()=>{
  const{window}=setup();const state=window.DG_PARK_ADMIN_STATE.create({lastContext:{projects:[1],measurements:[2]}});const renders=[];
  window.DG_TOGGLE_PARK_ADMIN_EMPTY.toggle(state,(...args)=>renders.push(args));
  assert.equal(state.getState().showEmpty,true);assert.deepEqual(renders,[[[1],[2]]]);
});

test('park admin controller fetches fresh data per invocation and keeps rows in its feature state',async()=>{
  const{window}=setup();let loads=0;
  window.DG_PARK_ADMIN_MUTATION_STORE={create:()=>({})};
  window.DG_SYNC_PARK_PROJECT_NAMES_ADAPTER={create:()=>async()=>({})};
  const controller=window.DG_PARK_ADMIN_CONTROLLER.create({
    window,getClient:()=>({}),isAdmin:()=>true,element:()=>null,escape:String,toast(){},
    loadApplication:async()=>({status:'ok',parks:[{id:++loads}],projects:[],measurements:[]}),
    loadProjects:null,loadWorld:null,loadAdminTree:null,normalizeLoose:String,normalizeName:String,
    formatHectares:String,distance:()=>0,translate:String,translateFormat:String,translateCommon:String,
    translatePlain:String,prompt(){},confirm(){},clearParkSession(){},backfillGeometry(){}
  });
  await controller.loadParkAdmin();await controller.loadParkAdmin();
  assert.equal(loads,2);assert.deepEqual(JSON.parse(JSON.stringify(controller.state.getState().rows)),[{id:2}]);
});

test('park backfill controller stores the latest plan and delegates its rendering',async()=>{
  const{window}=setup(),events=[];
  window.DG_OSM_PARK_NAME_SEARCH_ADAPTER={create:()=>async()=>[]};
  window.DG_BACKFILL_PARK_DETECTION_APPLICATION={create:()=>async()=>null};
  window.DG_PARK_BACKFILL_PROGRESS_UI={render:()=>{}};
  window.DG_PARK_BACKFILL_PLAN_APPLICATION={create:()=>async()=>({status:'ready',plan:[{project:{id:3}}]})};
  window.DG_PARK_BACKFILL_APPLY_APPLICATION={create:()=>async()=>({status:'cancelled'})};
  window.DG_PARK_BACKFILL_MANUAL_APPLICATION={create:()=>async()=>({status:'cancelled'})};
  window.DG_PARK_BACKFILL_PLAN_UI={render:input=>events.push(['render',input.plan[0].project.id]),close:()=>events.push(['close'])};
  const controller=window.DG_PARK_BACKFILL_CONTROLLER.create({window,document:{},setTimeout,element:()=>({}),escape:String,toast(){},translateFormat:String,translateCommon:String,isAdmin:()=>true,isOnline:()=>true,getClient:()=>({}),queryPark:async()=>null,warn(){},normalizeLoose:String,overpassRequest:async()=>({}),extractRings:()=>[],polyArea:()=>0,formatArea:String,suggestParkName:String,projectName:String,labelFromLegacy:String,registerPark:async()=>null,linkBackfillProject:null,updateBackfillProject:async()=>({}),backfillMeasurements:async()=>({}),confirm:()=>false,refreshAfterWrites(){}});
  await controller.backfillParks();
  assert.deepEqual(JSON.parse(JSON.stringify(controller.getPlan())),[{project:{id:3}}]);
  assert.deepEqual(events,[['render',3]]);
  controller.closePlan();assert.equal(controller.getPlan(),null);assert.deepEqual(events.at(-1),['close']);
});

test('backfill close clears and hides the plan container through its UI module',()=>{
  const{window}=setup(),box={style:{display:'block'},innerHTML:'plan'},document={getElementById:id=>id==='backfillBox'?box:null};
  window.DG_PARK_BACKFILL_PLAN_UI.close(document);
  assert.equal(box.style.display,'none');assert.equal(box.innerHTML,'');
});

test('backfill plan uses declarative controls and renderer-owned current callbacks',()=>{
  const{window}=setup(),listeners={};let called='';
  const box={style:{},innerHTML:'',addEventListener:(name,listener)=>{listeners[name]=listener;},contains:()=>true};
  window.DG_PARK_BACKFILL_PLAN_UI.render({box,plan:[{durum:'OSM parkı bulundu',project:{id:9,name:'Proje'},lat:40,lon:32}],escape:String,formatArea:()=> '1 ha',translateFormat:value=>value});
  assert.match(box.innerHTML,/data-park-backfill-action="manual" data-project-id="9"/);
  assert.match(box.innerHTML,/data-park-backfill-action="close"/);
  assert.doesNotMatch(box.innerHTML,/onclick=/);
  window.DG_PARK_BACKFILL_PLAN_UI.bind(box,{manual:control=>{called='old-'+control.dataset.projectId;}});
  window.DG_PARK_BACKFILL_PLAN_UI.bind(box,{manual:control=>{called='latest-'+control.dataset.projectId;}});
  listeners.click({target:{closest:()=>({dataset:{parkBackfillAction:'manual',projectId:'9'}})}});
  assert.equal(called,'latest-9');
});

test('park admin and backfill controllers load and are precached before park-registry',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/park-registry.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  const controller=read('src/bootstrap/park-admin-controller.js');
  for(const name of ['DG_PARK_ADMIN_STATE','DG_SYNC_PARK_PROJECT_NAMES_ADAPTER','DG_RENDER_PARK_ADMIN_UI','DG_REFRESH_PARK_ADMIN_VIEWS','DG_TOGGLE_PARK_ADMIN_EMPTY'])assert.ok(controller.includes(name),`${name} controller composition`);
  assert.ok(registry.includes('DG_PARK_ADMIN_CONTROLLER.create'),'legacy facade delegates to the park admin controller');
  assert.ok(registry.includes('DG_PARK_BACKFILL_CONTROLLER.create'),'legacy facade delegates to the backfill controller');
});
