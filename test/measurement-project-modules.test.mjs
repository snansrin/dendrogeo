import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/trees/project-selection-memory.js',
  'src/ui/open-project-for-measurement.js',
  'src/ui/measurement-project-card.js',
  'src/ui/measurement-project-park-box.js',
  'src/ui/measurement-project-name-preview.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('project preference stays local, ignores missing projects and tolerates storage errors',()=>{
  const{window}=setup(),values=new Map(),storage={setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)||null};
  const api=window.DG_PROJECT_SELECTION_MEMORY;
  api.remember(storage,'dg_last_proj',7);assert.equal(values.get('dg_last_proj'),'7');
  assert.equal(api.restore(storage,'dg_last_proj',[{id:7}]),'7');assert.equal(api.restore(storage,'dg_last_proj',[{id:8}]),null);
  api.remember({setItem(){throw Error('private mode');}},'dg_last_proj',9);
  assert.equal(api.restore({getItem(){throw Error('private mode');}},'dg_last_proj',[{id:7}]),null);
});

test('opening a project keeps navigation, remember, delayed select and gate order',()=>{
  const{window}=setup(),events=[],select={value:''};
  window.DG_OPEN_PROJECT_FOR_MEASUREMENT.open(7,{projects:()=>[{id:7}],remember:id=>events.push(['remember',id]),go:view=>events.push(['go',view]),
    schedule:(fn,delay)=>{events.push(['schedule',delay]);fn();},measureSelect:()=>select,projectChanged:()=>events.push('changed'),parkGate:()=>events.push('gate')});
  assert.equal(select.value,'7');assert.deepEqual(events.map(x=>Array.isArray(x)?x[0]:x),['remember','go','schedule','changed','gate']);
  assert.equal(events[2][1],80);
});

test('project cards escape names and preserve owner/shared action differences',()=>{
  const{window}=setup(),escape=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
  const api=window.DG_MEASUREMENT_PROJECT_CARD,project={id:4,name:'<Park>',park_id:2,parks:{name:'<Park>',area_m2:10000},city:'<City>',created_at:'2026-10-13'};
  const owner=api.render(project,false,{formatArea:()=> '1.0 ha',escape,isAdmin:()=>false});
  assert.match(owner,/&lt;Park&gt;/);assert.doesNotMatch(owner,/startParkScan/);assert.match(owner,/dgUserPubOpen/);
  const unlinkedAdmin=api.render({...project,park_id:null,parks:null},false,{formatArea:()=>'',escape,isAdmin:()=>true});
  assert.match(unlinkedAdmin,/startParkScan/);assert.doesNotMatch(unlinkedAdmin,/dgUserPubOpen/);
  const shared=api.render({...project,shared:true},true,{formatArea:()=> '1.0 ha',escape,isAdmin:()=>false});
  assert.match(shared,/is-shared/);assert.match(shared,/Ölçüme geç/);assert.match(shared,/proje sahibinde/);assert.doesNotMatch(shared,/dgUserPubOpen/);
});

test('park context updates only default city/country and still refreshes the name preview',()=>{
  const{window}=setup(),elements={pCity:{value:'Ankara'},pCountry:{value:'Türkiye'}},events=[],box={};
  window.DG_MEASUREMENT_PROJECT_PARK_BOX.render({box,park:{name:'Göksu',area_m2:30000,osm_key:'way/2',city:'Bolu',country:'Türkiye'},escape:value=>String(value),formatArea:()=> '3.0 ha',getElement:id=>elements[id],previewName:()=>events.push('preview')});
  assert.equal(box.className,'alert ok');assert.equal(elements.pCity.value,'Bolu');assert.equal(elements.pCountry.value,'Türkiye');assert.ok(box.innerHTML.includes('3.0 ha'));assert.deepEqual(events,['preview']);
  window.DG_MEASUREMENT_PROJECT_PARK_BOX.render({box,park:null,escape:String,formatArea:()=>'',getElement:id=>elements[id],previewName:()=>events.push('empty-preview')});
  assert.equal(box.className,'alert err');assert.ok(box.innerHTML.includes('Park algılanmadı'));assert.equal(events[1],'empty-preview');
});

test('canonical project-name preview preserves empty and populated states',()=>{
  const{window}=setup(),element={style:{},textContent:''};
  const render=window.DG_MEASUREMENT_PROJECT_NAME_PREVIEW.render;
  render({element,park:null,label:'x',projectName:(park,label)=>park+' - '+label});assert.equal(element.textContent,'— (önce park algıla)');assert.equal(element.style.color,'var(--mut)');
  render({element,park:{name:'Göksu'},label:'deneme',projectName:(park,label)=>park+' - '+label});assert.equal(element.textContent,'Göksu - deneme');assert.equal(element.style.color,'var(--ink)');
});

test('five project modules load before measure.js and remain available offline',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  const measure=read('src/services/measure.js');
  for(const token of ['DG_PROJECT_SELECTION_MEMORY','DG_OPEN_PROJECT_FOR_MEASUREMENT','DG_MEASUREMENT_PROJECT_CARD','DG_MEASUREMENT_PROJECT_PARK_BOX','DG_MEASUREMENT_PROJECT_NAME_PREVIEW'])assert.ok(measure.includes(token),`${token} service delegation`);
});
