import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const registry=read('src/services/park-registry.js');
const modules=[
  'src/application/parks/start-park-scan.js',
  'src/application/parks/focus-park-scan-target.js',
  'src/domain/parks/select-park-scan-step.js',
  'src/ui/preview-park-project-name.js',
  'src/application/parks/cancel-park-scan.js'
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

test('scan start module preserves state, map setup, focus, render and notice order',()=>{
  const events=[],card={scrollIntoView:options=>events.push(['scroll',options])};
  const map={invalidateSize:()=>events.push('invalidate')};
  const{context}=setup({DG_PARK_SCAN:false,DG_PARK_TARGET_PROJ:null,DG_PARK_RETURN_TO:null,PARK_MODE:false,map,
    go:view=>events.push(['go',view]),toggleParkMode:()=>events.push('toggle'),setTimeout:(fn,delay)=>{events.push(['schedule',delay]);fn();},
    dgFocusScanTarget:()=>events.push('focus'),dgRenderScanCard:()=>events.push('render'),$:id=>id==='parkScanCard'?card:null,
    toast:(...args)=>events.push(['notice',...args])});
  addFunction(context,'function startParkScan(opt){','/* Hedefe odaklan:');
  vm.runInContext('startParkScan({projectId:42,returnTo:"projects"})',context);
  assert.equal(context.DG_PARK_SCAN,true);assert.equal(context.DG_PARK_TARGET_PROJ,42);assert.equal(context.DG_PARK_RETURN_TO,'projects');
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['go','toggle','schedule','invalidate','focus','render','scroll','notice']);
  assert.equal(events.find(event=>Array.isArray(event)&&event[0]==='schedule')[1],200);
});

test('focus module uses project measurements and falls back to GPS only when none exist',async()=>{
  const calls=[];const map={fitBounds:(bounds,options)=>calls.push(['bounds',bounds,options]),setView:(point,zoom)=>calls.push(['gps',point,zoom])};
  const{context}=setup({DG_PARK_TARGET_PROJ:9,map,L:{latLngBounds:points=>({pad:value=>({points,value})})},GPS:{latitude:40,longitude:32},
    sb:{from:()=>({select(){return this;},eq(){return this;},limit:async()=>({data:[{lat:39,lon:32},{lat:null,lon:32}]})})}});
  addFunction(context,'async function dgFocusScanTarget(){','/* =========================================================\n   5. ALGILAMA KARTI');
  await vm.runInContext('dgFocusScanTarget()',context);
  assert.equal(calls.length,1);assert.equal(calls[0][0],'bounds');assert.equal(calls[0][1].value,.4);assert.equal(calls[0][2].maxZoom,17);
  context.sb.from=()=>({select(){return this;},eq(){return this;},limit:async()=>({data:[]})});
  await vm.runInContext('dgFocusScanTarget()',context);
  assert.equal(calls[1][0],'gps');assert.equal(calls[1][2],17);
});

test('scan step and project-name modules preserve candidate priority and displayed name',()=>{
  const elements={'scanNamePreview':{textContent:''},'scanLabel':{value:'deneme'}};
  const{context}=setup({DG_PARK:null,DG_PARK_CAND:{name:'Göksu'},$:id=>elements[id],dgProjectName:(park,label)=>park+' - '+label});
  addFunction(context,'function dgScanStep(){','function dgManualFormHTML');
  addFunction(context,'function dgScanPreviewName(){','function dgManualFormHTML');
  assert.equal(vm.runInContext('dgScanStep()',context),2);
  vm.runInContext('dgScanPreviewName()',context);
  assert.equal(elements.scanNamePreview.textContent,'Göksu - deneme');
  context.DG_PARK={id:1,name:'Başkent'};
  assert.equal(vm.runInContext('dgScanStep()',context),3);
});

test('cancel module clears discovery handoff and returns to its source view',()=>{
  const events=[];const{context}=setup({DG_PARK_SCAN:true,DG_PARK_TARGET_PROJ:7,DG_PARK_RETURN_TO:'measure',
    dgRenderScanCard:()=>events.push('render'),go:view=>events.push(['go',view])});
  addFunction(context,'function dgCancelScan(){','/* DB kaydı başarısız oldu');
  vm.runInContext('dgCancelScan()',context);
  assert.equal(context.DG_PARK_SCAN,false);assert.equal(context.DG_PARK_TARGET_PROJ,null);assert.equal(context.DG_PARK_RETURN_TO,null);
  assert.equal(events[0],'render');assert.equal(events[1][0],'go');assert.equal(events[1][1],'measure');
});

test('all five scan modules load before park-registry and remain in the offline precache',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/park-registry.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
});
