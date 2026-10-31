import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function moduleAt(path,window={}){
 runInNewContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{window});
 return window;
}
const geometry={outer:[[[39,32],[39,33],[40,33],[39,32]]],inner:[]};
const goksu={id:25,name:'Göksu Parkı',osm_key:'way/423602737',source:'osm',area_m2:508000,geom_json:geometry};
const stage={id:53,name:'Dikmen Vadisi · 2.etap',osm_key:'stage/50/'+'a'.repeat(32),source:'manual',geom_json:{...geometry,stage_scope:{parentId:50,schema:'dendrogeo/park-stage/1'}}};

test('saved normal parks reuse the exact recorded geometry and OSM identity',()=>{
 const root=moduleAt('src/domain/parks/live-map-project-candidate.js');
 const result=root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(goksu);
 assert.equal(result.id,423602737);assert.equal(result.type,'way');
 assert.strictEqual(result.rings.outer,goksu.geom_json.outer);
 assert.throws(()=>root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate({...goksu,geom_json:null}),/sınırı/);
 assert.throws(()=>root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate({...goksu,osm_key:'unknown'}),/kimliği/);
});
test('saved stages delegate immutable identity validation to existing stage policy',()=>{
 let checked=false;
 const root=moduleAt('src/domain/parks/live-map-project-candidate.js',{
  DG_PARK_STAGE_GEOMETRY:{candidate(row){checked=true;return {stageRow:row};}}
 });
 assert.equal(root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(stage).stageRow.id,53);
 assert.equal(checked,true);
});

function fakeDom(){
 const items={};
 function node(id){return items[id]={value:'',textContent:'',dataset:{},hidden:false,disabled:false,
  children:[],listeners:{},setAttribute(name,value){this[name]=value;},
  replaceChildren(){this.children=[];},append(el){this.children.push(el);},
  addEventListener(name,fn){this.listeners[name]=fn;},
  querySelectorAll(){return this.controls||[];}
 };}
 const host=node('dgLiveProjects'),select=node('dgLiveProjectSelect'),status=node('dgLiveProjectStatus');
 const actions=node('dgLiveProjectActions'),heading=node('dgLiveProjectActive');
 const mapView=node('v-map');mapView.classList={contains:()=>true};host.controls=[select];
 const stageButton={hidden:false};host.querySelector=selector=>selector==='[data-live-project-action="stages"]'?stageButton:null;
 return {host,select,status,actions,heading,stageButton,document:{getElementById:id=>items[id],createElement:()=>({value:'',textContent:''})}};
}

function uiScenario(overrides={}){
 const {host,select,status,actions,heading,stageButton,document}=fakeDom(),calls=[],projects=[{id:30,park_id:25,name:'Göksu'},{id:33,park_id:53,name:'Dikmen'}];
 let activePark=0;
 const root=moduleAt('src/ui/live-map-project-workspace.js');
 const ports={document,projects:()=>projects,remembered:()=>'',remember:id=>calls.push('remember '+id),
  isEditing:()=>false,readProject:async id=>({id,park_id:id===30?25:53,name:id===30?'Göksu':'Dikmen',is_locked:false}),
  readPark:async id=>id===25?goksu:id===53?stage:{...goksu,id:50},candidate:row=>({name:row.name}),
  readParent:async id=>id===50?{...goksu,id:50}:null,
  saveDraft:async()=>true,activeParkId:()=>activePark,prepareParent:async row=>calls.push('parent '+row.id),
  forgetParent:async()=>calls.push('forget deleted parent'),
  draw:async candidate=>{activePark=candidate.name==='Göksu Parkı'?25:53;calls.push('draw');},
  readWaypoints:async id=>Array.from({length:id===30?77:42},(_,i)=>({wp_id:i+1,lat:39,lon:32})),
  showWaypoints:rows=>calls.push('points '+rows.length),clearWaypoints:()=>calls.push('clear points'),selectProject:id=>calls.push('select '+id),
  openWaypoints:()=>{},openSurface:()=>{},openStages:()=>{},reloadProjects:async()=>{},...overrides};
 const ui=root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI.create(ports);
 return {ui,select,status,actions,heading,stageButton,calls,projects};
}

test('Göksu project opens existing boundary and points without creating data',async()=>{
 const x=uiScenario();x.select.value='30';await x.ui.open();
 assert.deepEqual(x.calls,['draw','points 77','select 30','remember 30']);
 assert.equal(x.actions.hidden,false);assert.match(x.status.textContent,/77 kayıtlı ölçüm noktası/);
});
test('Dikmen stage primes its parent then opens the original stage and points',async()=>{
 const x=uiScenario();x.select.value='33';await x.ui.open();
 assert.deepEqual(x.calls,['parent 50','draw','points 42','select 33','remember 33']);
});
test('Dikmen stage survives deleted parent without fabricating geometry or mutating saved waypoints',async()=>{
 const x=uiScenario({readParent:async()=>null});x.select.value='33';await x.ui.open();
 assert.deepEqual(x.calls,['forget deleted parent','draw','points 42','select 33','remember 33']);
 assert.equal(x.stageButton.hidden,true);
 assert.match(x.status.textContent,/Ana park kaydı eksik/);
 assert.equal(x.actions.hidden,false,'surface and waypoints must remain available');
});
test('project selection refuses stale authorization, unsaved drafts and active editors',async()=>{
 const stale=uiScenario({readProject:async()=>({id:30,park_id:99})});stale.select.value='30';await stale.ui.open();
 assert.equal(stale.calls.length,0);assert.match(stale.status.textContent,/erişimi/);
 const draft=uiScenario({saveDraft:async()=>false});draft.select.value='30';await draft.ui.open();
 assert.equal(draft.calls.length,0);assert.match(draft.status.textContent,/kaydedilemedi/);
 const editing=uiScenario({isEditing:()=>true});editing.select.value='33';await editing.ui.open();
 assert.equal(editing.calls.length,0);assert.match(editing.status.textContent,/tamamlayıp/);
});
test('completed project is visible but never selected as an editable field target',async()=>{
 const locked=uiScenario({readProject:async()=>({id:30,park_id:25,name:'Göksu',is_locked:true})});
 locked.select.value='30';await locked.ui.open();
 assert.deepEqual(locked.calls,['draw','points 77','remember 30']);
 assert.equal(locked.actions.hidden,true);
 assert.match(locked.status.textContent,/salt okunur/);
});
test('revoked project access clears only its transient waypoint overlay',async()=>{
 const x=uiScenario();x.select.value='30';await x.ui.open();
 x.projects.splice(0,1);x.ui.refresh();
 assert.equal(x.calls.at(-1),'clear points');assert.equal(x.actions.hidden,true);
});
test('Supabase store uses only exact RLS reads; no creates, updates or deletes',async()=>{
 const operations=[];
 const client={from(table){operations.push(table);return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:30},error:null})};}};
 const root=moduleAt('src/adapters/parks/live-map-project-store.js',{
  DG_FETCH_PROJECT_WAYPOINTS:{fetch:async()=>({data:[{wp_id:1}],error:null})}
 });
 const store=root.DG_LIVE_MAP_PROJECT_STORE.create(client);
 assert.equal((await store.project(30)).id,30);
 assert.equal((await store.park(25)).id,30);
 assert.equal((await store.parent(50)).id,30);
 assert.equal((await store.waypoints(30)).length,1);
 assert.deepEqual(operations,['projects','parks','parks']);
});
test('missing stage parent is a non-error read while missing selected park remains a hard stop',async()=>{
 const client={from(){return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})};}};
 const root=moduleAt('src/adapters/parks/live-map-project-store.js');
 const store=root.DG_LIVE_MAP_PROJECT_STORE.create(client);
 assert.equal(await store.parent(50),null);
 await assert.rejects(store.park(50),/Kayıtlı park veya etap bulunamadı/);
});
test('saved surface opens from account/device review after a clean scan, without persistence writes',async()=>{
 const root=moduleAt('src/ui/live-map-project-surface.js');
 const plain=value=>JSON.parse(JSON.stringify(value));
 const calls=[],ports={parkId:53,currentParkId:()=>53,saveExisting:async()=>{calls.push('saved previous draft');return true;},scan:async()=>{calls.push('scan');},hasCells:()=>true,
  currentRecordParkId:()=>53,openSavedReview:async()=>{calls.push('restore existing review');},savedRecord:()=>({parkId:53,draftSavedAt:'2026-10-31'})};
 assert.deepEqual(plain(await root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore(ports)),{ready:true,restored:true});
 assert.deepEqual(calls,['saved previous draft','scan','restore existing review']);
 await assert.rejects(root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore({...ports,saveExisting:async()=>false}),/taslağı kaydedilemedi/);
 assert.deepEqual(plain(await root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore({...ports,savedRecord:()=>({parkId:53})})),{ready:true,restored:false});
 assert.deepEqual(plain(await root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore({...ports,hasCells:()=>false})),{ready:false,restored:false});
 assert.deepEqual(plain(await root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore({...ports,currentParkId:()=>25})),{ready:false,restored:false});
 assert.deepEqual(plain(await root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore({...ports,currentRecordParkId:()=>25})),{ready:false,restored:false});
 assert.deepEqual(calls,['saved previous draft','scan','restore existing review','saved previous draft','scan','restore existing review','saved previous draft','scan','saved previous draft','scan','saved previous draft','scan']);
});
test('live-map bootstrap reuses existing map/waypoint tools without a second writer',()=>{
 const source=readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8');
 assert.match(source,/DG_LIVE_MAP_PROJECT_WORKSPACE_UI\.create/);
 assert.match(source,/DG_LIVE_MAP_PROJECT_CANDIDATE\.candidate/);
 assert.match(source,/DG_GRID_WAYPOINT_LAYER\.render/);
 assert.match(source,/saveDraft:/);
 assert.match(source,/DG_PARK_SESSION\.set\(key,row\)/);
 assert.doesNotMatch(source,/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});
