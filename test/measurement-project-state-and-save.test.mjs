import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/application/trees/measurement-project-state.js',
  'src/domain/trees/build-measurement-project-write.js',
  'src/adapters/trees/persist-measurement-project.js',
  'src/application/trees/save-measurement-project.js',
  'src/ui/measurement-project-edit-form.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('feature-scoped project store publishes snapshots and unsubscribes cleanly',()=>{
  const{window}=setup(),store=window.DG_MEASUREMENT_PROJECT_STATE.create(),snapshots=[];
  const off=store.subscribe(state=>snapshots.push(state));
  const loading=store.setState({loading:true});
  store.setState({projects:[{id:7}],loading:false});off();store.setState({error:'late'});
  assert.equal(loading.loading,true);assert.equal(snapshots.length,2);assert.deepEqual(JSON.parse(JSON.stringify(snapshots[1].projects)),[{id:7}]);
  assert.equal(store.getState().error,'late');assert.equal(Object.isFrozen(store.getState()),true);
});

test('project payload builder preserves update fields, insert fallbacks and park gates',()=>{
  const{window}=setup(),build=window.DG_BUILD_MEASUREMENT_PROJECT_WRITE.build,composeName=(name,label)=>name+' - '+label;
  assert.equal(JSON.stringify(build({editId:5,editPark:{id:3},park:{id:9},userId:'u',label:'x',country:'',city:'',composeName})),JSON.stringify({kind:'update',id:5,payload:{label:'x',park_id:3,country:'',city:''}}));
  assert.equal(JSON.stringify(build({editId:null,editPark:null,park:{id:9,name:'Park',country:'TR',city:'Bolu'},userId:'u',label:'work',country:'',city:'',composeName})),JSON.stringify({kind:'insert',name:'Park - work',payload:{owner:'u',park_id:9,label:'work',name:'Park - work',country:'TR',city:'Bolu'}}));
  assert.equal(JSON.stringify(build({editId:5,editPark:null,park:null,userId:'u',label:'x',country:'',city:'',composeName})),JSON.stringify({kind:'park-required',mode:'update',projectId:5}));
  assert.equal(JSON.stringify(build({editId:null,editPark:null,park:null,userId:'u',label:'x',country:'',city:'',composeName})),JSON.stringify({kind:'park-required',mode:'insert',projectId:null}));
});

test('project persistence adapter retains RLS query shape and insert body',async()=>{
  const{window}=setup(),calls=[];
  const client={from:table=>({update:payload=>({eq:(column,id)=>{calls.push(['update',table,payload,column,id]);return{error:null};}}),insert:payload=>{calls.push(['insert',table,payload]);return{error:null};}})};
  await window.DG_PERSIST_MEASUREMENT_PROJECT.persist({client,command:{kind:'update',id:5,payload:{label:'x',park_id:3,country:'TR',city:'Bolu'}}});
  await window.DG_PERSIST_MEASUREMENT_PROJECT.persist({client,command:{kind:'insert',payload:{owner:'u',park_id:3,label:'x'}}});
  assert.equal(JSON.stringify(calls),JSON.stringify([['update','projects',{label:'x',park_id:3,country:'TR',city:'Bolu'},'id',5],['insert','projects',{owner:'u',park_id:3,label:'x'}]]));
});

test('save workflow gates missing parks, reports writes and refreshes after success',async()=>{
  const{window}=setup(),events=[],save=window.DG_SAVE_MEASUREMENT_PROJECT.save;
  const ports={label:()=> '  field  ',form:()=>({}),build:input=>({kind:'insert',name:'Park - field',payload:{label:input.label}}),persist:async command=>{events.push(['persist',command]);return{error:null};},requirePark:command=>events.push(['park',command]),failure:error=>events.push(['failure',error.message]),updated:()=>events.push('updated'),created:command=>events.push(['created',command.name]),refresh:()=>events.push('refresh')};
  const missing=await save({...ports,build:()=>({kind:'park-required',mode:'insert',projectId:null}),persist:async()=>{throw Error('must not write');}});
  assert.equal(missing.reason,'park-required');assert.equal(events.length,1);
  events.length=0;
  const failed=await save({...ports,persist:async()=>({error:{message:'denied'}})});
  assert.equal(failed.reason,'write-failed');assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['failure']);
  events.length=0;
  const done=await save(ports);
  assert.equal(done.ok,true);assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['persist','created','refresh']);assert.equal(events[0][1].payload.label,'field');
});

test('edit form preserves owner-only edit, legacy label, values and cancel state',()=>{
  const{window}=setup(),events=[],elements=Object.fromEntries(['projCreateDetails','pLabel','pCountry','pCity','projSaveBtn','projCancelBtn'].map(id=>[id,{value:'',style:{},open:false,textContent:''}]));
  const ports={projects:()=>[{id:4,name:'Park - old',park_id:2,park_name:'Park',country:'TR',city:'Ankara',shared:false},{id:5,shared:true}],element:id=>elements[id],setEditing:(id,park)=>events.push(['edit',id,park&&park.id]),labelFromLegacy:()=> 'old',renderParkBox:()=>events.push('park-box')};
  assert.equal(window.DG_MEASUREMENT_PROJECT_EDIT_FORM.begin(5,ports),null);
  const project=window.DG_MEASUREMENT_PROJECT_EDIT_FORM.begin(4,ports);
  assert.equal(project.id,4);assert.deepEqual(events.slice(0,2).map(event=>Array.isArray(event)?event[0]:event),['edit','park-box']);assert.equal(elements.pLabel.value,'old');assert.equal(elements.pCountry.value,'TR');assert.equal(elements.pCity.value,'Ankara');assert.equal(elements.projSaveBtn.textContent,'💾 Projeyi Güncelle');assert.equal(elements.projCancelBtn.style.display,'inline-block');
  window.DG_MEASUREMENT_PROJECT_EDIT_FORM.cancel(ports);assert.deepEqual(events.at(-2),['edit',null,null]);assert.equal(elements.pLabel.value,'');assert.equal(elements.projSaveBtn.textContent,'+ Proje Oluştur');assert.equal(elements.projCancelBtn.style.display,'none');
});

test('project directory use case exposes its store as the legacy PROJ_LIST facade',async()=>{
  const paths=['src/adapters/trees/fetch-owned-measurement-projects.js','src/adapters/trees/fetch-shared-measurement-projects.js','src/domain/trees/merge-measurement-projects.js','src/ui/render-measurement-project-directory.js',...modules.slice(0,1),'src/application/trees/load-measurement-project-directory.js'];
  const window={},context=vm.createContext({window});for(const path of paths)vm.runInContext(read(path),context,{filename:path});
  let legacy=[];const observed=[];
  const projects=await window.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load({onState:state=>{legacy=state.projects;observed.push(state.loading);},fetchOwned:async()=>[{id:1}],fetchShared:async()=>[{id:2,shared:true}],merge:(own,shared)=>[...own,...shared],render:()=>{},afterRender:()=>{}});
  assert.deepEqual(JSON.parse(JSON.stringify(legacy)),[{id:1},{id:2,shared:true}]);assert.deepEqual(JSON.parse(JSON.stringify(projects)),JSON.parse(JSON.stringify(legacy)));assert.deepEqual(observed,[true,false]);
  assert.equal(window.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().loading,false);
});

test('five state/save modules precede measure.js and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  const source=read('src/services/measure.js');for(const token of ['DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY','DG_BUILD_MEASUREMENT_PROJECT_WRITE','DG_PERSIST_MEASUREMENT_PROJECT','DG_SAVE_MEASUREMENT_PROJECT','DG_MEASUREMENT_PROJECT_EDIT_FORM'])assert.ok(source.includes(token),token);
});
