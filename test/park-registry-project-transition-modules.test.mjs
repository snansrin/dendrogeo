import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const registry=read('src/services/park-registry.js');
const modules=[
  'src/domain/parks/select-park-project.js',
  'src/adapters/parks/park-scan-redirect-memory.js',
  'src/ui/complete-park-project-link.js',
  'src/application/parks/handle-park-project-change.js',
  'src/application/parks/handle-park-drawn.js'
];
function setup(extra={}){
  const window={};const context=vm.createContext({window,...extra});
  for(const path of modules)vm.runInContext(read(path),context,{filename:path});
  return{window,context};
}
function addFunction(context,start,end){
  const from=registry.indexOf(start),to=registry.indexOf(end,from);
  assert.ok(from>=0&&to>from,`${start} function boundary is present`);
  vm.runInContext(registry.slice(from,to),context,{filename:'src/services/park-registry.js'});
}

test('selected project uses the current dropdown value and exact project ID',()=>{
  const{context,window}=setup({PROJ_LIST:[{id:1,name:'A'},{id:2,name:'B'}],$:id=>id==='mProject'?{value:'2'}:null});
  addFunction(context,'function dgSelectedProject(){','/* Ölçüm sekmesine OTOMATİK');
  assert.equal(vm.runInContext('dgSelectedProject().name',context),'B');
  assert.equal(window.DG_SELECT_PARK_PROJECT.resolve('0',context.PROJ_LIST),null);
});

test('park-scan redirect memory redirects once and fails closed when storage is unavailable',()=>{
  const{window}=setup();const storage=new Map();
  const adapter=window.DG_PARK_SCAN_REDIRECT_MEMORY;
  const getStorage=()=>({getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)});
  assert.equal(adapter.wasRedirectedOrMark(12,getStorage),false);
  assert.equal(adapter.wasRedirectedOrMark(12,getStorage),true);
  assert.equal(adapter.wasRedirectedOrMark(13,()=>{throw new Error('blocked');}),true);
});

test('project-link completion refreshes selectors before clearing scan state and navigating',async()=>{
  const events=[];const{window}=setup();
  const elements={mProject:{value:''},nProject:{value:''}};
  await window.DG_COMPLETE_PARK_PROJECT_LINK.complete({id:7},{
    loadProjects:async()=>events.push('load'),element:id=>elements[id],refreshGate:()=>events.push('gate'),
    getReturnTo:()=>{events.push('return');return 'measure';},setScanActive:value=>events.push(['active',value]),
    setTargetProject:value=>events.push(['target',value]),setReturnTo:value=>events.push(['back',value]),
    renderCard:()=>events.push('render'),go:view=>events.push(['go',view])
  });
  assert.equal(elements.mProject.value,'7');assert.equal(elements.nProject.value,'7');
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['load','gate','return','active','target','back','render','go']);
});

test('project change preserves preference/presence/gate order and only refreshes an eligible point',()=>{
  const events=[];const{context,window}=setup();
  addFunction(context,'function dgProjectChanged(){','/* Proje listesi seçeneği');
  window.DG_HANDLE_PARK_PROJECT_CHANGE.changed({selectedValue:()=>4,rememberProject:value=>events.push(['remember',value]),joinCurrentPark:()=>events.push('presence'),refreshGate:()=>events.push('gate'),hasManualPoint:()=>false,isEditing:()=>false,refreshPointSuggestion:()=>events.push('suggest')});
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['remember','presence','gate','suggest']);
  events.length=0;
  window.DG_HANDLE_PARK_PROJECT_CHANGE.changed({selectedValue:()=>4,rememberProject:()=>{throw new Error();},joinCurrentPark:()=>{throw new Error();},refreshGate:()=>events.push('gate'),hasManualPoint:()=>true,isEditing:()=>false,refreshPointSuggestion:()=>events.push('suggest')});
  assert.deepEqual(events,['gate']);
});

test('drawn-park flow registers online, warns offline, updates state and refreshes',async()=>{
  const events=[];const{window}=setup();const flow=window.DG_HANDLE_PARK_DRAWN;
  const row={id:3};
  assert.equal(await flow.handle({name:'park'},{isOnline:()=>true,register:async candidate=>{events.push(['register',candidate.name]);return row;},notifyOffline:()=>events.push('offline'),setCandidate:value=>events.push(['candidate',value]),setPark:value=>events.push(['park',value]),renderCard:()=>events.push('render')}),row);
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['register','candidate','park','render']);
  events.length=0;
  await flow.handle({name:'offline park'},{isOnline:()=>false,register:()=>events.push('register'),notifyOffline:()=>events.push('offline'),setCandidate:value=>events.push(['candidate',value]),setPark:value=>events.push(['park',value]),renderCard:()=>events.push('render')});
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['offline','candidate','park','render']);
});

test('all five project transition modules load before park-registry and are precached/delegated',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/park-registry.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  for(const name of ['DG_SELECT_PARK_PROJECT','DG_PARK_SCAN_REDIRECT_MEMORY','DG_COMPLETE_PARK_PROJECT_LINK','DG_HANDLE_PARK_PROJECT_CHANGE','DG_HANDLE_PARK_DRAWN'])assert.ok(registry.includes(name),`${name} service delegation`);
});
