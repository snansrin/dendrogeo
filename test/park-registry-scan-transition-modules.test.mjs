import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const registry=read('src/services/park-registry.js');
const modules=[
  'src/domain/parks/resolve-manual-park-coordinate.js',
  'src/ui/show-manual-park-form.js',
  'src/application/parks/toggle-park-mode-from-scan.js',
  'src/application/parks/show-park-project-step.js',
  'src/application/parks/retry-park-registration.js'
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

test('manual coordinate module preserves pending, anchor, then GPS priority',()=>{
  const{window}=setup();const resolve=window.DG_RESOLVE_MANUAL_PARK_COORDINATE.resolve;
  assert.deepEqual(resolve({pending:{lat:1,lon:2},anchor:{lat:3,lon:4},gps:{latitude:5,longitude:6}}),{lat:1,lon:2});
  assert.deepEqual(resolve({pending:null,anchor:{lat:3,lon:4},gps:{latitude:5,longitude:6}}),{lat:3,lon:4});
  assert.equal(JSON.stringify(resolve({pending:null,anchor:null,gps:{latitude:5,longitude:6}})),JSON.stringify({lat:5,lon:6}));
  assert.equal(resolve({pending:null,anchor:null,gps:null}),null);
});

test('manual form opens existing box or seeds and rerenders the card',()=>{
  const events=[];const{window}=setup();const show=window.DG_SHOW_MANUAL_PARK_FORM.show;
  const box={style:{display:'none'}};
  show({element:id=>id==='manualParkBox'?box:null,setPending:()=>events.push('pending'),resolvePoint:()=>({lat:1,lon:2}),renderCard:()=>events.push('render')});
  assert.equal(box.style.display,'block');assert.deepEqual(events,[]);
  show({element:()=>null,setPending:point=>events.push(['pending',point]),resolvePoint:()=>({lat:7,lon:8}),renderCard:force=>events.push(['render',force])});
  assert.deepEqual(events,[['pending',{lat:7,lon:8}],['render',true]]);
});

test('scan mode toggle and project step retain toggle, render and scroll ordering',()=>{
  const events=[];const card={scrollIntoView:options=>events.push(['scroll',options])};const{window}=setup();
  window.DG_TOGGLE_PARK_MODE_FROM_SCAN.toggle({toggle:()=>events.push('toggle'),renderCard:()=>events.push('render')});
  window.DG_SHOW_PARK_PROJECT_STEP.show({setScanActive:value=>events.push(['active',value]),renderCard:()=>events.push('render'),element:id=>id==='parkScanCard'?card:null});
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['toggle','render','active','render','scroll']);
  assert.equal(events[2][1],true);assert.equal(events[4][1].behavior,'smooth');
});

test('registration retry keeps missing-candidate, successful render/notice and presence behavior',async()=>{
  const events=[];const{context,window}=setup({});
  await window.DG_RETRY_PARK_REGISTRATION.retry(null,{notify:(...args)=>events.push(['notice',...args])});
  assert.deepEqual(events,[['notice','Önce park algıla','err','🌳']]);
  const row={id:8,name:'Kent Parkı'};
  const result=await window.DG_RETRY_PARK_REGISTRATION.retry({name:'Kent Parkı'}, {
    register:async candidate=>{events.push(['register',candidate.name]);return row;},setPark:value=>{context.DG_PARK=value;events.push('park');},
    renderCard:()=>events.push('render'),notify:(...args)=>events.push(['notice',...args]),successMessage:value=>'✓ '+value.name,
    recordPresence:(...args)=>{events.push(['presence',...args]);throw new Error('best effort');}
  });
  assert.equal(result,row);assert.equal(context.DG_PARK,row);
  assert.deepEqual(events.slice(1).map(event=>Array.isArray(event)?event[0]:event),['register','park','render','notice','presence']);
});

test('park-registry delegates scan transitions and loads them before the service from precache',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/park-registry.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  for(const name of ['DG_RESOLVE_MANUAL_PARK_COORDINATE','DG_SHOW_MANUAL_PARK_FORM','DG_TOGGLE_PARK_MODE_FROM_SCAN','DG_SHOW_PARK_PROJECT_STEP','DG_RETRY_PARK_REGISTRATION'])assert.ok(registry.includes(name),`${name} service delegation`);
});
