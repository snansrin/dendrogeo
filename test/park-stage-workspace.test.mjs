import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import polygon from 'polygon-clipping';
const context=vm.createContext({window:{},console});
for(const file of ['src/domain/parks/stage-geometry.js','src/application/parks/activate-stage-scope.js','src/adapters/parks/stage-store.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const api=context.window.DG_PARK_STAGE_GEOMETRY,plain=v=>JSON.parse(JSON.stringify(v));
const square=(a,b,size=1)=>[[a,b],[a,b+size],[a+size,b+size],[a+size,b],[a,b]];
const row={id:102,osm_key:'stage/101/'+'a'.repeat(32),name:'Ana park · Bölüm 1',area_m2:100,geom_json:{outer:[square(39,32)],inner:[],stage_scope:{schema:'dendrogeo/park-stage/1',parentId:101}}};
test('Stage clipping keeps real disconnected areas and holes, without changing parent or bridging',()=>{
 const parent={outer:[square(39,32),square(39,34)],inner:[square(39.2,32.2,.2)]},before=JSON.stringify(parent);
 const result=plain(api.clip([[38,31],[38,36],[41,36],[41,31],[38,31]],parent,polygon));
 assert.equal(result.outer.length,2);assert.equal(result.inner.length,1);assert.equal(JSON.stringify(parent),before);
 assert.ok(result.outer.every(r=>Math.max(...r.map(p=>p[1]))<=33||Math.min(...r.map(p=>p[1]))>=34));
});
test('Stage geometry rejects bowtie, collinear, repeated, invalid, excessive and open rings',()=>{
 for(const ring of [[[0,0],[1,1],[0,1],[1,0],[0,0]],[[0,0],[1,0],[2,0],[0,0]],[[0,0],[1,1],[0,0],[1,0],[0,0]],[[0,0],[100,0],[0,1],[0,0]],square(39,32).slice(0,-1),Array.from({length:302},()=>[1,1])])assert.equal(api.validateRing(ring),false);
 assert.throws(()=>api.clip(square(1,1),{outer:[square(39,32)],inner:[]},polygon),/kesişmiyor/);
});
test('Stage candidate is an independent park identity/geometry and rejects wrong parent identity',()=>{
 const candidate=api.candidate(row);assert.equal(candidate.stageRow.id,102);assert.equal(candidate.rings.outer[0][0][0],39);
 candidate.rings.outer[0][0][0]=0;assert.equal(row.geom_json.outer[0][0][0],39);
 assert.throws(()=>api.candidate({...row,osm_key:'way/1'}),/geçersiz/);
 assert.throws(()=>api.candidate({...row,osm_key:'stage/999/'+'a'.repeat(32)}),/geçersiz/);
});
test('Exact stage fence never calls the old margin/circle fallback, including missing geometry and GPS',()=>{
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:5},row,{ACC_MAX_M:60},()=>true).ok,true);
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:5},row,{ACC_MAX_M:60},()=>false).ok,false);
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:61},row,{ACC_MAX_M:60},()=>true).ok,false);
 assert.equal(api.fence(null,row,{ACC_MAX_M:60},()=>true).ok,false);
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:5},{...row,geom_json:null},{ACC_MAX_M:60},()=>true).ok,false);
 assert.equal(api.fence(null,{osm_key:'way/1'},{},()=>true),null);
 for(const fix of [{lat:null,lon:32,acc:5},{lat:39,lon:null,acc:5},{lat:39,lon:32,acc:null},{lat:39,lon:32,acc:-1},{lat:91,lon:32,acc:5}]){
  assert.equal(api.fence(fix,row,{ACC_MAX_M:60},()=>true).ok,false);
 }
});
test('New measurements must select a stage-linked project; historical edits and ordinary parks keep old gates',()=>{
 assert.equal(api.measurementGate({park:row,project:{park_id:101}}).reason,'stage-project-required');
 assert.equal(api.measurementGate({park:row,project:{park_id:102}}),null);
 assert.equal(api.measurementGate({park:row,project:{park_id:101},editId:5}),null);
 assert.equal(api.measurementGate({park:{id:101,osm_key:'way/1'},project:{park_id:200}}),null);
});
test('Scope activation validates and saves old draft before drawing; cancellation/stale/failure cannot draw',async()=>{
 const calls=[],ports={isBusy:()=>false,validate:async()=>calls.push('validate'),approveTransition:async()=>{calls.push('save');return true;},isCurrent:()=>true,draw:async()=>calls.push('draw')};
 assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),true);assert.deepEqual(calls,['validate','save','draw']);
 calls.length=0;ports.approveTransition=async()=>false;assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),false);assert.deepEqual(calls,['validate']);
 ports.approveTransition=async()=>true;ports.isCurrent=()=>false;calls.length=0;assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),false);assert.deepEqual(calls,['validate']);
 ports.validate=async()=>{throw Error('network');};await assert.rejects(context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),/network/);
});
test('Late stage validation cannot save a different park draft or start while the editor becomes busy',async()=>{
 for(const change of ['stale','busy']){
  let current=true,busy=false,release,approved=0,drawn=0;
  const wait=new Promise(resolve=>{release=resolve;});
  const run=context.window.DG_ACTIVATE_STAGE_SCOPE.create({isBusy:()=>busy,isCurrent:()=>current,validate:()=>wait,approveTransition:async()=>{approved++;return true;},draw:async()=>{drawn++;}});
  const result=run({});if(change==='stale')current=false;else busy=true;release();
  assert.equal(await result,false);assert.equal(approved,0);assert.equal(drawn,0);
 }
 const ports={isBusy:()=>false,isCurrent:()=>true,approveTransition:async()=>true,draw:async()=>false};
 assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),false);
});
test('Stage adapter resolves only the exact stored id/key and rejects geometry tampering',async()=>{
 const calls=[],client={from:t=>{calls.push(t);return{select(){return this;},eq(k,v){calls.push([k,v]);return this;},single:async()=>({data:row,error:null})};}};
 const store=context.window.DG_PARK_STAGE_STORE.create(()=>client),candidate=api.candidate(row);
 assert.equal((await store.resolve(candidate)).id,102);assert.deepEqual(calls,['parks',['id',102],['osm_key',row.osm_key]]);
 candidate.rings.outer[0][0][0]=0;await assert.rejects(store.resolve(candidate),/eşleşmiyor/);
});
test('Equivalent JSON property ordering is not mistaken for a changed stage boundary',async()=>{
 const reordered={...row,geom_json:{stage_scope:{parentId:101,schema:'dendrogeo/park-stage/1'},inner:[],outer:row.geom_json.outer}};
 const client={from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:reordered,error:null})})};
 const store=context.window.DG_PARK_STAGE_STORE.create(()=>client),candidate=api.candidate(row);
 candidate.rings={inner:[],outer:candidate.rings.outer};
 assert.equal((await store.resolve(candidate)).id,102);
});
test('Stage view escapes user content and exposes labelled controls with explicit boundary acceptance',()=>{
 vm.runInContext(readFileSync(new URL('../src/ui/park-stage-view.js',import.meta.url),'utf8'),context);
 const render=context.window.DG_PARK_STAGE_VIEW.render,escape=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const html=render({escape,baseName:'<img src=x>',rows:[{...row,geom_json:{...row.geom_json,stage_scope:{label:'<script>bad</script>'}}}],ready:true,editing:true});
 assert.doesNotMatch(html,/<img|<script>/);assert.match(render({escape,baseName:'Park',rows:[],ready:true,editing:false}),/for="dgStageSelect"/);assert.match(html,/for="dgStageName"/);assert.match(html,/Etap olarak kaydet/);assert.match(html,/role="status"/);
 const revision=render({escape,baseName:'Park',rows:[],ready:true,editing:true,revision:true});assert.doesNotMatch(revision,/data-stage-action="(?:draw|suggest|pick)"/);assert.match(revision,/başlangıç|Başlangıç/);
 const selection=render({escape,baseName:'Park',rows:[],ready:true,editing:false});assert.match(selection,/Seçili etapta çalış/);assert.match(selection,/Etap düzenle/);
});
test('Stage drawing restores detection/guard and removes temporary parent boundary on Escape',()=>{
 vm.runInContext(readFileSync(new URL('../src/ui/park-stage-drawing.js',import.meta.url),'utf8'),context);
 const listeners={},layers=new Set();let mode=true,guard=false,zoom=true;
 const map={on:(event,fn)=>{listeners[event]=fn;},off:event=>delete listeners[event],removeLayer:l=>layers.delete(l),fitBounds(){},doubleClickZoom:{enabled:()=>zoom,disable:()=>{zoom=false;},enable:()=>{zoom=true;}}};
 const document={addEventListener:(event,fn)=>{listeners[event]=fn;},removeEventListener:event=>delete listeners[event]};
 const layer=()=>({addTo(){layers.add(this);return this;},getBounds(){return {};}});
 const drawing=context.window.DG_PARK_STAGE_DRAWING_UI.create({document,leaflet:{polyline:layer,polygon:layer},getMap:()=>map,getMode:()=>mode,setMode:v=>{mode=v;},getGuard:()=>guard,setGuard:v=>{guard=v;},parentGeometry:()=>row.geom_json,status(){}});
 drawing.start();assert.equal(mode,false);assert.equal(guard,true);assert.equal(zoom,false);assert.equal(layers.size,1);
 listeners.click({latlng:{lat:39,lng:32}});listeners.click({latlng:{lat:40,lng:32}});assert.equal(drawing.ring().length,3);
 drawing.undo();assert.equal(drawing.ring().length,2);listeners.keydown({key:'Escape'});
 assert.equal(mode,true);assert.equal(guard,false);assert.equal(zoom,true);assert.equal(layers.size,0);assert.deepEqual(Object.keys(listeners),[]);
});
test('Stage bootstrap refuses a failed draft save and reuses only an exactly validated stage identity',async()=>{
 let ports,resolves=0,saveResult=false;
 const root={DG_PARK_STAGE_STORE:{create:()=>({resolve:async c=>{resolves++;return c.stageRow;}})},DG_PARK_STAGE_WORKSPACE_UI:{create:p=>{ports=p;return {};}},DG_LC_SENS:{state:{record:{}}}};
 const ctx=vm.createContext({window:root,document:{},esc:String,L:{},sb:{},dgSensSave:async()=>saveResult});
 vm.runInContext(readFileSync(new URL('../src/bootstrap/park-stage-workspace.js',import.meta.url),'utf8'),ctx);
 await assert.rejects(ports.approveTransition(),/kaydedilemedi/);saveResult=true;assert.equal(await ports.approveTransition(),true);
 const candidate=api.candidate(row);await ports.validate(candidate);assert.equal((await root.DG_RESOLVE_STAGE_PARK(candidate)).id,102);assert.equal(resolves,1);
 for(const state of [{busy:true},{brush:{}},{draw:{}},{objectPick:true},{objectPreview:{}},{saving:true},{exporting:true}]){root.DG_LC_SENS.state=state;assert.equal(ports.isBusy(),true);}
 root.DG_LC_SENS.state={};ctx.document.querySelector=()=>({});assert.equal(ports.isBusy(),true);
 ctx.document.querySelector=()=>null;assert.equal(ports.isBusy(),false);
});
test('Late stage drawing completion does not clear navigation belonging to the newly selected park',async()=>{
 let ports,release;const wait=new Promise(resolve=>{release=resolve;});
 const root={DG_PARK_STAGE_STORE:{create:()=>({})},DG_PARK_STAGE_WORKSPACE_UI:{create:p=>{ports=p;return {};}},DG_NORMALIZE_DRAWN_PARK_GEOMETRY:{normalize:park=>({outer:park.rings.outer})}};
 const ctx=vm.createContext({window:root,document:{getElementById:()=>null},esc:String,L:{},sb:{},drawPark:()=>wait,
  PARK_POLY:[],DG_PARK_CAND:null,WP:[{id:55}],LAST_WP_ROWS:[{id:66}],navTarget:{id:77},PROJ_LIST:[],DG_PARK:{id:999},EDIT_ID:null});
 vm.runInContext(readFileSync(new URL('../src/bootstrap/park-stage-workspace.js',import.meta.url),'utf8'),ctx);
 const result=ports.draw(api.candidate(row));release();assert.equal(await result,false);
 assert.equal(ctx.WP[0].id,55);assert.equal(ctx.LAST_WP_ROWS[0].id,66);assert.equal(ctx.navTarget.id,77);
});
test('Drawing captures real map clicks ahead of interactive surface paths, ignores controls and releases its listener',()=>{
 vm.runInContext(readFileSync(new URL('../src/ui/park-stage-drawing.js',import.meta.url),'utf8'),context);
 const mapListeners={},domListeners={},docListeners={};let moved=false,stopped=0;
 const target={addEventListener:(key,fn,capture)=>{assert.equal(capture,true);domListeners[key]=fn;},removeEventListener:(key,fn,capture)=>{assert.equal(capture,true);assert.equal(domListeners[key],fn);delete domListeners[key];}};
 const map={on:(key,fn)=>{mapListeners[key]=fn;},off:key=>delete mapListeners[key],getContainer:()=>target,mouseEventToLatLng:()=>({lat:39,lng:32}),removeLayer(){},dragging:{moved:()=>moved},doubleClickZoom:{enabled:()=>false,disable(){}}};
 const document={addEventListener:(key,fn)=>{docListeners[key]=fn;},removeEventListener:key=>delete docListeners[key]};
 const drawing=context.window.DG_PARK_STAGE_DRAWING_UI.create({document,leaflet:{polyline:()=>({addTo(){return this;}})},getMap:()=>map,getMode:()=>false,setMode(){},getGuard:()=>false,setGuard(){},status(){}});
 drawing.start();const event={target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){stopped++;}};
 domListeners.click(event);assert.equal(drawing.ring().length,2);assert.equal(stopped,1);
 moved=true;domListeners.click(event);moved=false;domListeners.click({...event,target:{closest:()=>true}});assert.equal(stopped,1);
 drawing.cancel();assert.deepEqual(Object.keys(domListeners),[]);assert.deepEqual(Object.keys(mapListeners),[]);assert.deepEqual(Object.keys(docListeners),[]);
});
test('Stage workspace binds UI workflow with parent-scoped reads and current-epoch guards',()=>{
 // The real three-width browser workflow executes this same controller.
 const source=readFileSync(new URL('../src/ui/park-stage-workspace.js',import.meta.url),'utf8');
 assert.match(source,/ports\.store\.list\(base\.row\.id\)/);assert.match(source,/token!==epoch/);
 assert.match(source,/parentId===base\.row\.id/);assert.match(source,/DG_ACTIVATE_STAGE_SCOPE\.create/);
});
test('Missing parent retains the existing stage menu as read-only without loading or writing geometry',async()=>{
 let mounted=null,storeCalls=0,drawCalls=0;
 const host={innerHTML:'',setAttribute(){},addEventListener(){},querySelector:()=>null};
 const document={getElementById:()=>({}),createElement:()=>host};
 const root={
  DG_PARK_STAGE_DRAWING_UI:{create:()=>({cancel(){}})},
  DG_PARK_STAGE_ASSISTED_UI:{create:()=>({clear(){}})},
  DG_PARK_STAGE_MENU_UI:{create:()=>({mount:element=>{mounted=element;},clear(){},refresh(){},status(){}})}
 };
 vm.runInNewContext(readFileSync(new URL('../src/ui/park-stage-workspace.js',import.meta.url),'utf8'),{window:root});
 const workspace=root.DG_PARK_STAGE_WORKSPACE_UI.create({document,escape:value=>String(value).replaceAll('<','&lt;'),drawing:{},
  store:{ready:async()=>{storeCalls++;return true;},list:async()=>{storeCalls++;return[];}},draw:()=>{drawCalls++;}});
 const orphan={id:53,name:'Dikmen',geom_json:{stage_scope:{parentId:50,label:'2. etap <test>'}}};
 await workspace.present({park:null,row:null});
 await workspace.present({park:{name:'Dikmen'},row:orphan});
 assert.equal(mounted,host,'Etaplar toolbar owner must mount even without the parent');
 assert.match(host.innerHTML,/2\. etap &lt;test>/);
 assert.match(host.innerHTML,/Ana park kaydı eksik/);
 assert.doesNotMatch(host.innerHTML,/data-stage-action=/,'editing cannot be offered with missing parent geometry');
 assert.equal(storeCalls,0);assert.equal(drawCalls,0);
});
test('A stale workspace action cannot draw, overwrite status or unlock controls in a different park',async()=>{
 for(const phase of ['validation','validation-error','clear']){
  let reached,release,reject,approved=0,drawn=0;
  const started=new Promise(resolve=>{reached=resolve;}),pending=new Promise((resolve,fail)=>{release=resolve;reject=fail;});
  const hosts=[],models=[];
  const document={getElementById:()=>({append:host=>hosts.push(host)}),createElement:()=>{
   const host={status:{textContent:''},attrs:{},innerHTML:'',className:'',listeners:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},querySelectorAll:()=>[],querySelector(selector){return selector==='#dgStageSelect'?{value:'102'}:selector==='#dgStageStatus'?this.status:{focus(){}};}};return host;
  }};
  const root={DG_PARK_STAGE_DRAWING_UI:{create:()=>({cancel(){},ring:()=>[]})},DG_PARK_STAGE_MENU_UI:{create:()=>({mount:host=>hosts.push(host),clear(){},status(){},refresh(){},hideHint(){},hideCuts(){},setBusy(){}})},DG_PARK_STAGE_ASSISTED_UI:{create:()=>({clear(){},setLocked(){}})},DG_PARK_STAGE_VIEW:{render:model=>{models.push(model);return ''; }},DG_ACTIVATE_STAGE_SCOPE:context.window.DG_ACTIVATE_STAGE_SCOPE,DG_PARK_STAGE_GEOMETRY:api};
  const ctx=vm.createContext({window:root,console});
  vm.runInContext(readFileSync(new URL('../src/ui/park-stage-workspace.js',import.meta.url),'utf8'),ctx);
  const workspace=root.DG_PARK_STAGE_WORKSPACE_UI.create({document,escape:String,drawing:{},geometry:()=>({outer:row.geom_json.outer,inner:[]}),isBusy:()=>false,
   store:{ready:async()=>true,list:async()=>[row]},
   validate:async()=>{if(phase.startsWith('validation')){reached();await pending;}},
   approveTransition:async()=>{approved++;return true;},clearAnalysis:async()=>{if(phase==='clear'){reached();await pending;}},draw:async()=>{drawn++;}});
  await workspace.present({park:{name:'First'},row:{id:101,name:'First'}});
  hosts[0].listeners.click({target:{closest:()=>({disabled:false,dataset:{stageAction:'apply'}})}});await started;
  workspace.clear();await workspace.present({park:{name:'Second'},row:{id:201,name:'Second'}});
  hosts.at(-1).listeners.click({target:{closest:()=>({disabled:false,dataset:{stageAction:'edit'}})}});
  assert.equal(models.at(-1).editing,true,'new park controls remain usable while an old request is pending');
  if(phase==='validation-error')reject(Error('stale network error'));else release();
  for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(drawn,0);assert.equal(approved,phase==='clear'?1:0);
  assert.equal(hosts.at(-1).status.textContent,'');
 }
});
