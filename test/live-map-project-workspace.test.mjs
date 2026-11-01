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
const stage={id:53,name:'Dikmen Vadisi · 2.etap',osm_key:'stage/50/'+'a'.repeat(32),source:'manual',created_by:'same-owner',geom_json:{...geometry,stage_scope:{parentId:50,parentKey:'relation/14290362',schema:'dendrogeo/park-stage/1'}}};

test('saved project controls retain English labels for mobile language switching',()=>{
 const source=readFileSync(new URL('../src/config/i18n-en.js',import.meta.url),'utf8');
 const translations=runInNewContext(source+'\nDG_I18N_EN');
 assert.equal(translations['💾 Çalışmayı bu cihazda sakla'],'💾 Save workspace on this device');
 assert.match(translations['Etaplar menüsü doğrulanan ana parka yeniden bağlandı.'],/Stages menu was reconnected/);
 assert.match(translations['{n} kayıtlı ölçüm noktası ve seçilen etap değişmeden açıldı. Etaplar menüsü doğrulanan ana parka yeniden bağlandı.'],/original stage/);
 assert.equal(translations['Haritada açmak için bir proje seç.'],'Select a project to open it on the map.');
});

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
 const mapView=node('v-map');mapView.classList={contains:()=>true};host.controls=[select];
 return {host,select,status,document:{getElementById:id=>items[id],createElement:()=>({value:'',textContent:''})}};
}

function uiScenario(overrides={}){
 const {host,select,status,document}=fakeDom(),calls=[],projects=[{id:30,park_id:25,name:'Göksu'},{id:33,park_id:53,name:'Dikmen'}];
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
 return {ui,select,status,calls,projects};
}

test('Göksu project opens existing boundary and points without creating data',async()=>{
 const x=uiScenario();x.select.value='30';await x.ui.open();
 assert.deepEqual(x.calls,['draw','points 77','select 30','remember 30']);
 assert.match(x.status.textContent,/77 kayıtlı ölçüm noktası/);
});
test('project selector stays blank until the user selects a project, then opens it',async()=>{
 const x=uiScenario({remembered:()=> '33'});
 assert.equal(x.select.value,'');assert.deepEqual(x.calls,[]);
 x.select.value='30';x.select.listeners.change();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(x.calls,['draw','points 77','select 30','remember 30'],'selection by the user must reopen their chosen project');
 assert.match(x.status.textContent,/77 kayıtlı ölçüm noktası/);
});
test('explicit open restores only the chosen project snapshot and focuses the verified park',async()=>{
 const x=uiScenario({restoreWorkspace:async(project,park)=>{x.calls.push('restore '+project.id+'/'+park.id);return {mode:'cached',scan:true,grid:123};},
  watchWorkspace:(id,park)=>x.calls.push('watch '+id+'/'+park.id),focusPark:()=>x.calls.push('focus park'),
  saveWorkspace:async(id,parkId)=>{x.calls.push('save before switch '+id+'/'+parkId);return true;}});
 x.select.value='30';await x.ui.open();
 assert.deepEqual(x.calls,['draw','points 77','select 30','remember 30','restore 30/25','watch 30/25','focus park']);
 assert.match(x.status.textContent,/123 grid hücresi/);
 x.select.value='33';x.select.listeners.change();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(x.calls.slice(7),['save before switch 30/25','parent 50','draw','points 42','select 33','remember 33','restore 33/53','watch 33/53','focus park']);
});
test('Dikmen stage primes its parent then opens the original stage and points',async()=>{
 const x=uiScenario();x.select.value='33';await x.ui.open();
 assert.deepEqual(x.calls,['parent 50','draw','points 42','select 33','remember 33']);
});
test('Dikmen stage survives deleted parent without fabricating geometry or mutating saved waypoints',async()=>{
 const x=uiScenario({readParent:async()=>null});x.select.value='33';await x.ui.open();
 assert.deepEqual(x.calls,['forget deleted parent','draw','points 42','select 33','remember 33']);
 assert.match(x.status.textContent,/Ana park kaydı eksik/);
});
test('deleted parent ID is recovered only by matching canonical OSM key and same creator; stage 53 stays active',async()=>{
 const canonical={...goksu,id:54,name:'Dikmen Vadisi',osm_key:'relation/14290362',created_by:'same-owner'};
 const keys=[];
 const x=uiScenario({readParent:async()=>null,readParentByKey:async key=>{keys.push(key);return canonical;},
  restoreWorkspace:async(project,park)=>{x.calls.push('restore '+project.id+'/'+park.id);return{mode:'cached',grid:123,scan:true};},
  focusPark:()=>x.calls.push('focus 53')});
 x.select.value='33';await x.ui.open();
 assert.deepEqual(keys,['relation/14290362']);
 assert.deepEqual(x.calls,['parent 54','draw','points 42','select 33','remember 33','restore 33/53','focus 53']);
 assert.match(x.status.textContent,/doğrulanan ana parka yeniden bağlandı/);
 assert.match(x.status.textContent,/123 grid hücresi/);
});
test('recovery refuses mismatched owners, wrong keys, stage-as-parent and missing parent identity',async()=>{
 const canonical={...goksu,id:54,osm_key:'relation/14290362',created_by:'same-owner'};
 for(const replacement of [{...canonical,created_by:'other-owner'},{...canonical,osm_key:'relation/1'},
  {...canonical,geom_json:stage.geom_json},{...canonical,id:53}]){
  const x=uiScenario({readParent:async()=>null,readParentByKey:async()=>replacement});
  x.select.value='33';await x.ui.open();
  assert.deepEqual(x.calls,['forget deleted parent','draw','points 42','select 33','remember 33']);
  assert.match(x.status.textContent,/Ana park kaydı eksik/);
 }
});
test('a replacement parent with no saved boundary never prevents reopening the original stage and its 42 points',async()=>{
 const incomplete={...goksu,id:54,osm_key:'relation/14290362',created_by:'same-owner',geom_json:null};
 const x=uiScenario({readParent:async()=>null,readParentByKey:async()=>incomplete,
  candidate:row=>{if(!row.geom_json?.outer)throw Error('Projenin kayıtlı park sınırı bulunamadı. Kayıt değiştirilmedi.');return{name:row.name};},
  restoreWorkspace:async(project,park)=>{x.calls.push('restore '+project.id+'/'+park.id);return{mode:'cached',scan:true,grid:123};}});
 x.select.value='33';await x.ui.open();
 assert.deepEqual(x.calls,['forget deleted parent','draw','points 42','select 33','remember 33','restore 33/53']);
 assert.match(x.status.textContent,/123 grid hücresi/);
 assert.match(x.status.textContent,/Ana park kaydı eksik/);
 assert.doesNotMatch(x.status.textContent,/Proje açılamadı/);
});
test('an inaccessible or geometry-less historical parent is optional; the chosen stage remains active',async()=>{
 for(const readParent of [async()=>{throw Error('parent RLS read failed');},async()=>({...goksu,id:50,geom_json:null})]){
  const x=uiScenario({readParent,readParentByKey:async()=>null,
   candidate:row=>{if(!row.geom_json?.outer)throw Error('parent boundary missing');return{name:row.name};}});
  x.select.value='33';await x.ui.open();
  assert.deepEqual(x.calls,['forget deleted parent','draw','points 42','select 33','remember 33']);
  assert.match(x.status.textContent,/Ana park kaydı eksik/);
 }
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
 assert.match(locked.status.textContent,/salt okunur/);
});
test('revoked project access clears only its transient waypoint overlay',async()=>{
 const x=uiScenario();x.select.value='30';await x.ui.open();
 x.projects.splice(0,1);x.ui.refresh();
 assert.equal(x.calls.at(-1),'clear points');
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
 assert.equal((await store.parentByKey('relation/14290362')).id,30);
 assert.equal(await store.parentByKey('stage/50/abc'),null);
 assert.equal((await store.waypoints(30)).length,1);
 assert.deepEqual(operations,['projects','parks','parks','parks']);
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
test('device snapshot persists exact existing raster/grid state without mixing owners, parks or revisions',async()=>{
 const root=moduleAt('src/ui/live-map-project-snapshot.js'),snapshots=new Map(),events=[],original={analysis:{report:{year:2021},result:{cells:[{row:1,col:2}]}},grid:{cells:[{id:'c1'}],selected:['c1'],reviewBasis:null}};
 const store={async save(id,value){const key=id.ownerId+':'+id.projectId+':'+id.parkId;snapshots.set(key,JSON.parse(JSON.stringify(value)));},async read(id){return snapshots.get(id.ownerId+':'+id.projectId+':'+id.parkId)||null;}};
 const controller=root.DG_LIVE_MAP_PROJECT_SNAPSHOT.create({store,capture:()=>original,apply:async state=>{events.push(state);return {scan:true,grid:state.grid.cells.length};}});
 const scope={ownerId:'sinan',projectId:33,parkId:53,geometry,engine:'2026-v1'};
 assert.equal((await controller.save(scope)).saved,true);
 assert.equal((await controller.restore(scope)).grid,1);
 assert.equal(events.length,1);assert.deepEqual(JSON.parse(JSON.stringify(events[0])),original);
 assert.equal((await controller.restore({...scope,ownerId:'someone-else'})).restored,false);
 assert.equal((await controller.restore({...scope,parkId:25})).restored,false);
 assert.equal((await controller.restore({...scope,geometry:{...geometry,outer:[[[39,32],[40,33],[40,32],[39,32]]]}})).reason,'changed');
 assert.equal((await controller.restore({...scope,engine:'2027-v2'})).reason,'changed');
 const empty=root.DG_LIVE_MAP_PROJECT_SNAPSHOT.create({store,capture:()=>({analysis:null,grid:{cells:[]}}),apply:()=>{}});
 assert.equal((await empty.save(scope)).empty,true);
 assert.equal(snapshots.size,1,'empty save never overwrites the last complete snapshot');
 assert.equal(root.DG_LIVE_MAP_PROJECT_SNAPSHOT.reviewBasis({record:null}),null);
});
test('device snapshot adapter requires IndexedDB rather than performing any remote fallback write',async()=>{
 const root=moduleAt('src/adapters/parks/live-map-project-snapshot-store.js');
 const store=root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE.create(()=>null);
 const scope={ownerId:'sinan',projectId:33,parkId:53};
 await assert.rejects(store.read(scope),/Cihazda kalıcı çalışma alanı kullanılamıyor/);
 await assert.rejects(store.save(scope,{state:{grid:{cells:[]}}}),/Cihazda kalıcı çalışma alanı kullanılamıyor/);
});
test('bootstrap restores selected cached project only after resolving the lazy scientific engine version',async()=>{
 const order=[],root={};let ports;
 root.DG_LIVE_MAP_PROJECT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT={reviewBasis:()=>null,create:()=>({
  save:async()=>{order.push('save device');return true;},
  restore:async scope=>{order.push('read '+scope.projectId+'/'+scope.parkId+'/'+scope.engine);return{scan:true,grid:12};}
 })};
 root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI={create:result=>(ports=result,{})};
 const env={window:root,sb:{},USER:{id:'account-one'},DG_PARK:{id:53,geom_json:stage.geom_json},
  document:{addEventListener:()=>{}},dgEnsureLulc:async()=>{order.push('load lazy engine');env.DG_LC_ENGINE_VERSION='core-v1';}};
 runInNewContext(readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8'),env);
 const restored=await ports.restoreWorkspace({id:33,is_locked:false},stage);
 assert.equal(restored.mode,'cached');
 assert.deepEqual(order,['load lazy engine','read 33/53/core-v1']);
 const locked=await ports.restoreWorkspace({id:33,is_locked:true},stage);
 assert.equal(locked.restored,false);assert.equal(locked.mode,'readonly');
 assert.deepEqual(order,['load lazy engine','read 33/53/core-v1'],'locked projects never load editable snapshots');
});
test('saved grid and waypoint visibility are both restored when switching between projects',async()=>{
 const root={};let apply;
 root.DG_LIVE_MAP_PROJECT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT={reviewBasis:()=>null,create:ports=>{apply=ports.apply;return{save:async()=>true,restore:async()=>({})};}};
 root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI={create:()=>({})};
 root.DG_LC_SENS={state:{record:null}};
 const controls={togGrid:{checked:false},togWp:{checked:true},gridSize:{value:'20'},gridClearance:{value:'3'},chkGreenOnly:{checked:false},refHa:{value:''}};
 const layers=new Set(['wp']),map={hasLayer:id=>layers.has(id),addLayer:id=>layers.add(id),removeLayer:id=>layers.delete(id)};
 const cells=[],selection=new Set(),gridSession={getCells:()=>cells,getSelection:()=>selection,setMeta:()=>{},setSource:()=>{},getGridLayer:()=> 'grid',getWaypointLayer:()=> 'wp'};
 const env={window:root,sb:{},USER:{id:'account-one'},DG_PARK:{id:25,geom_json:goksu.geom_json},
  DG_GRID_SESSION:gridSession,DG_GREEN_ONLY:false,document:{addEventListener:()=>{},getElementById:id=>controls[id]},
  map,drawGridLayer:()=>layers.add('grid'),dgGridReviewSignature:()=>null};
 runInNewContext(readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8'),env);
 const grid={cells:[{id:'one'}],selected:['one'],reviewBasis:null,options:{gridVisible:true,waypointVisible:false,greenOnly:false}};
 assert.equal((await apply({grid},{parkId:25})).grid,1);
 assert.equal(controls.togGrid.checked,true);assert.equal(controls.togWp.checked,false);
 assert.equal(layers.has('grid'),true);assert.equal(layers.has('wp'),false);
 await apply({grid:{...grid,options:{gridVisible:false,waypointVisible:true,greenOnly:false}}},{parkId:25});
 assert.equal(controls.togGrid.checked,false);assert.equal(controls.togWp.checked,true);
 assert.equal(layers.has('grid'),false);assert.equal(layers.has('wp'),true);
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
test('saved-project selector does not add a second GIS action toolbar',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 assert.match(shell,/id="dgLiveProjectSelect"/);
 assert.match(shell,/id="surfaceMenuBar"/);
 assert.doesNotMatch(shell,/dgLiveProjectActions|data-live-project-action="(?:stages|surface|waypoints|save)"/);
});

test('a saved review without its original raster never triggers an automatic rescan',async()=>{
 const root={};let ports,scans=0;
 root.DG_LIVE_MAP_PROJECT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT={reviewBasis:()=>null,create:()=>({
  save:async()=>true,restore:async()=>({restored:false,scan:false,grid:0})
 })};
 root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI={create:value=>(ports=value,{})};
 root.DG_LC_VALIDATE={loadCampaigns:async()=>[{owner:'account-one'}]};
 root.DG_SURFACE_REVIEW={load:async()=>({revision:7})};
 const env={window:root,sb:{},USER:{id:'account-one'},DG_PARK:{id:53,geom_json:stage.geom_json},
  document:{addEventListener:()=>{}},runLandCoverAnalysis:async()=>{scans++;throw Error('must never scan');}};
 runInNewContext(readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8'),env);
 const result=await ports.restoreWorkspace({id:33,is_locked:false},stage);
 assert.equal(result.mode,'evidence-missing');
 assert.equal(scans,0,'saved surface records cannot be silently replaced with new raster calculations');
});

test('saved stage scope is scrolled into view and its missing Leaflet display layer is restored',()=>{
 const calls=[],root={};let ports;
 root.DG_LIVE_MAP_PROJECT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE={create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT={reviewBasis:()=>null,create:()=>({})};
 root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI={create:value=>(ports=value,{})};
 root.DG_PARK_BOUNDARY_LAYER_UI={
  render:({outer,onCreated})=>{calls.push('render '+outer.length);onCreated({eachLayer:fn=>fn({bringToFront:()=>calls.push('front')})});},
  fit:({outer})=>calls.push('fit '+outer.length)
 };
 const map={hasLayer:()=>false,invalidateSize:()=>calls.push('invalidate')};
 const env={window:root,sb:{},USER:{id:'account-one'},DG_PARK:{id:53,geom_json:stage.geom_json},
  PARK_POLY:stage.geom_json.outer,PARK_HOLES:[],PARK_LAYER:null,L:{},map,
  document:{addEventListener:()=>{},getElementById:id=>id==='map'?{scrollIntoView:options=>calls.push('scroll '+options.block)}:null}};
 runInNewContext(readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8'),env);
 ports.focusPark();
 assert.deepEqual(calls,['scroll start','invalidate','render 1','front','fit 1']);
});
