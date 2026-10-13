import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/trees/fetch-owned-measurement-projects.js',
  'src/adapters/trees/fetch-shared-measurement-projects.js',
  'src/domain/trees/merge-measurement-projects.js',
  'src/ui/render-measurement-project-directory.js',
  'src/application/trees/load-measurement-project-directory.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('owned project adapter retains embedded park read and schema fallback',async()=>{
  const{window}=setup(),calls=[];
  const client={from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return{eq(column,value){calls.push(['eq',column,value]);return calls.length===3?{data:null,error:{message:'missing relation'}}:{data:[{id:8}],error:null};}};}};}};
  const errors=[];
  const rows=await window.DG_OWNED_MEASUREMENT_PROJECTS.fetch({client,userId:'u1',onRelationError:error=>errors.push(error)});
  assert.deepEqual(rows,[{id:8}]);assert.deepEqual(errors,['projects↔parks: missing relation']);
  assert.deepEqual(calls,[['from','projects'],['select','*,parks(id,name,city,country,area_m2)'],['eq','owner','u1'],['from','projects'],['select','*'],['eq','owner','u1']]);
});

test('shared project adapter scopes collaborator parks and supplies missing park embeds',async()=>{
  const{window}=setup(),queries=[];
  const client={from(table){assert.equal(table,'projects');return{select(columns){queries.push(columns);return{in:(field,ids)=>{queries.push([field,ids]);return{data:[{id:3,park_id:14}],error:null};}};}};}};
  const rows=await window.DG_SHARED_MEASUREMENT_PROJECTS.fetch({client,ownedProjects:[{id:1,park_id:12}],listMyParks:async()=>[{id:12,role:'collaborator',name:'Owned Park'},{id:14,role:'collaborator',name:'Shared Park',city:'Bolu'},{id:15,role:'owner'}]});
  assert.deepEqual(queries,["*,parks(id,name,city,country,area_m2)",['park_id',[14]]]);
  assert.equal(JSON.stringify(rows),JSON.stringify([{id:3,park_id:14,shared:true,parks:{id:14,name:'Shared Park',city:'Bolu'}}]));
  assert.equal(JSON.stringify(await window.DG_SHARED_MEASUREMENT_PROJECTS.fetch({client,ownedProjects:[],listMyParks:async()=>{throw Error('offline');}})),"[]");
});

test('domain merge keeps owner-first order without mutating either collection',()=>{
  const{window}=setup(),own=[{id:1}],shared=[{id:2,shared:true}],merged=window.DG_MERGE_MEASUREMENT_PROJECTS.merge(own,shared);
  assert.equal(JSON.stringify(merged),JSON.stringify([{id:1},{id:2,shared:true}]));assert.notEqual(merged,own);assert.deepEqual(own,[{id:1}]);assert.deepEqual(shared,[{id:2,shared:true}]);
});

test('directory UI preserves selector restore, owner/shared cards, counts and empty state',()=>{
  const{window}=setup(),elements=Object.fromEntries(['mProject','nProject','projOwnCount','projSharedCount','projOwnList','projSharedList','projSharedSection','projTable','projCreateDetails'].map(id=>[id,{innerHTML:'',textContent:'',style:{},open:false}]));
  const events=[];
  window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects:[{id:1,name:'Oak'},{id:2,name:'Shared',shared:true}],element:id=>elements[id],escape:String,optionLabel:project=>project.name,restore:()=>events.push('restore'),renderCard:(project,isShared)=>`${isShared?'S':'O'}${project.id}`,editing:false});
  assert.deepEqual(events,['restore']);assert.match(elements.mProject.innerHTML,/Oak/);assert.equal(elements.projOwnCount.textContent,'1');assert.equal(elements.projSharedCount.textContent,'1');
  assert.equal(elements.projOwnList.innerHTML,'O1');assert.equal(elements.projSharedList.innerHTML,'S2');assert.equal(elements.projSharedSection.style.display,'');assert.equal(elements.projTable.innerHTML,'O1S2');assert.equal(elements.projCreateDetails.open,false);
  window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects:[],element:id=>elements[id],escape:String,optionLabel:project=>project.name,restore:()=>{},renderCard:()=>'',editing:false});
  assert.equal(elements.mProject.innerHTML,"<option value=''>Önce park algıla → proje oluştur</option>");assert.match(elements.projOwnList.innerHTML,/Henüz kendi projen yok/);assert.equal(elements.projSharedSection.style.display,'none');assert.equal(elements.projCreateDetails.open,true);
});

test('application loads, merges, stores and renders in order',async()=>{
  const{window}=setup(),events=[],owned=[{id:1}],shared=[{id:2,shared:true}];
  const result=await window.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load({fetchOwned:async()=>{events.push('owned');return owned;},fetchShared:async rows=>{events.push(['shared',rows]);return shared;},merge:(a,b)=>{events.push('merge');return [...a,...b];},setProjects:rows=>events.push(['set',rows]),render:rows=>events.push(['render',rows]),afterRender:rows=>events.push(['after',rows])});
  assert.deepEqual(result,[...owned,...shared]);assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['owned','shared','merge','set','render','after']);
});

test('five directory modules load before measure.js and remain available offline',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.match(read('src/services/measure.js'),/DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY/);
});
