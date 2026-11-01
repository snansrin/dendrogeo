"use strict";
/* Bridge saved project identities into the original park, stage, waypoint and
 * surface controls. No independent geometry writer or scientific engine. */
(function(root){
 const store=root.DG_LIVE_MAP_PROJECT_STORE.create(sb),key=()=>"dg_live_project_"+(typeof USER!=="undefined"?USER?.id||"guest":"guest");
 function setSelect(id){
  for(const name of ["gridProject","mProject","nProject"]){
   if(name==="mProject"&&typeof EDIT_ID!=="undefined"&&EDIT_ID)continue;
   const control=document.getElementById(name);
   if(control&&[...control.options].some(option=>option.value===String(id)))control.value=String(id);
  }
 }
 function openWaypoints(id){setSelect(id);go("nav");}
 function openStages(){
  if(root.DG_PARK_STAGES?.open)root.DG_PARK_STAGES.open();
  const box=document.getElementById("dgParkStageWorkspace");
  if(box){box.scrollIntoView({behavior:"smooth",block:"nearest"});box.querySelector("#dgStageSelect")?.focus({preventScroll:true});}
  else document.getElementById("parkInfo")?.scrollIntoView({behavior:"smooth",block:"nearest"});
 }
 // Account sync wraps the frozen device store without modifying scientific or
 // protected storage modules. Supabase policies enforce exact account/project/stage.
 const deviceSnapshotStore=root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE.create(()=>root.indexedDB);
 const pendingFlush=new Set(),lastAccountWrite=new Map();
 const scopeKey=id=>String(id.ownerId)+":"+id.projectId+":"+id.parkId;
 const accountSnapshotStore=Object.freeze({
  markFlush:id=>pendingFlush.add(scopeKey(id)),
  async read(id){
   let local=null,cloud=null;
   try{local=await deviceSnapshotStore.read(id);}catch(error){console.warn("DENDROGEO · cihaz çalışma arşivi:",error.message);}
   try{
    const {data,error}=await sb.from("project_workspace_snapshots").select("payload")
     .eq("owner",id.ownerId).eq("project_id",id.projectId).eq("park_id",id.parkId).maybeSingle();
    if(error)throw error;
    cloud=data?.payload||null;
   }catch(error){console.warn("DENDROGEO · hesap çalışma arşivi:",error.message);}
   // Never allow another engine version or geometry revision to supersede
   // a valid same-device snapshot.
   if(cloud&&(cloud.ownerId!==id.ownerId||cloud.projectId!==id.projectId||
      cloud.parkId!==id.parkId||cloud.geometry!==id.geometry||cloud.engine!==id.engine||
      cloud.schema!=="dendrogeo/live-map-project-snapshot/1"))cloud=null;
   return cloud&&(!local||Date.parse(cloud.savedAt)>Date.parse(local.savedAt))?cloud:local;
  },
  async save(id,snapshot){
   const k=scopeKey(id),urgent=pendingFlush.delete(k);
   let savedDevice=false,deviceError=null;
   try{await deviceSnapshotStore.save(id,snapshot);savedDevice=true;}catch(error){deviceError=error;}
   let savedAccount=false;
   if(urgent||Date.now()-(lastAccountWrite.get(k)||0)>30000){
    try{
     const body=JSON.stringify(snapshot);
     if(body.length>8*1024*1024)throw Error("Hesap çalışma arşivi boyut sınırını aşıyor.");
     const {error}=await sb.from("project_workspace_snapshots").upsert({
      owner:id.ownerId,project_id:id.projectId,park_id:id.parkId,payload:snapshot
     },{onConflict:"owner,project_id,park_id"});
     if(error)throw error;
     lastAccountWrite.set(k,Date.now());savedAccount=true;
    }catch(error){console.warn("DENDROGEO · hesap çalışma arşivi kaydedilemedi:",error.message);}
   }
   if(!savedDevice&&!savedAccount)throw deviceError||Error("Proje çalışma arşivi kaydedilemedi.");
   return {savedDevice,savedAccount};
  }
 });
 const snapshots=root.DG_LIVE_MAP_PROJECT_SNAPSHOT.create({
  store:accountSnapshotStore,
  capture:()=>{
   const session=DG_GRID_SESSION,record=root.DG_LC_SENS?.state;
   return {
    // The last raster result is global; it must not leak into the next park
    // if that park has not yet mounted its own review.
    analysis:Number(record?.record?.parkId)===Number(DG_PARK?.id)&&typeof DG_LC_LAST!=="undefined"&&Array.isArray(DG_LC_LAST?.result?.cells)&&DG_LC_LAST.result.cells.length?DG_LC_LAST:null,
    grid:{cells:session.getCells(),selected:[...session.getSelection()],meta:session.getMeta(),source:session.getSource(),
     reviewBasis:root.DG_LIVE_MAP_PROJECT_SNAPSHOT.reviewBasis(record),
     options:{size:document.getElementById("gridSize")?.value||"20",clearance:document.getElementById("gridClearance")?.value||"3",
      reference:document.getElementById("refHa")?.value||"",greenOnly:!!DG_GREEN_ONLY,
      gridVisible:document.getElementById("togGrid")?.checked!==false,waypointVisible:document.getElementById("togWp")?.checked!==false}}
   };
  },
  apply:async(state,{parkId})=>{
   let scan=false,grid=0;
   const last=state.analysis;
   if(last?.result?.cells?.length&&last.result.cells.length<=60000&&last.report){
    if(!root.DG_LC_SENS?.mount&&typeof dgEnsureLulc==="function")await dgEnsureLulc();
   }
   if(last?.result?.cells?.length&&last.result.cells.length<=60000&&last.report&&root.DG_LC_SENS?.mount){
    DG_LC_LAST=last;
    const report=document.getElementById("landCoverReport");
    if(report&&root.DG_LANDCOVER_RENDER_REPORT){report.style.display="block";root.DG_LANDCOVER_RENDER_REPORT(report,last.report,parkAreaM2());}
    document.getElementById("v-map")?.classList.add("surface-review-active");
    await root.DG_LC_SENS.mount("lcSens",{freshAnalysis:false});
    scan=Number(root.DG_LC_SENS.state.record?.parkId)===parkId;
   }
   const saved=state.grid;
   if(saved?.cells?.length&&saved.cells.length<=30000&&Array.isArray(saved.selected)&&saved.selected.length<=30000&&
      saved.reviewBasis===root.DG_LIVE_MAP_PROJECT_SNAPSHOT.reviewBasis(root.DG_LC_SENS?.state)){
    const cells=DG_GRID_SESSION.getCells(),selection=DG_GRID_SESSION.getSelection();
    cells.splice(0,cells.length,...saved.cells);selection.clear();for(const id of saved.selected)selection.add(id);
    DG_GRID_SESSION.setMeta(saved.meta||"");DG_GRID_SESSION.setSource(dgGridReviewSignature());
    const options=saved.options||{};
    for(const [id,value] of [["gridSize",options.size],["gridClearance",options.clearance]]){
     const control=document.getElementById(id);if(control&&value!=null)control.value=String(value);
    }
    const green=document.getElementById("chkGreenOnly");if(green)green.checked=!!options.greenOnly;DG_GREEN_ONLY=!!options.greenOnly;
    const reference=document.getElementById("refHa");if(reference&&options.reference!==undefined){reference.value=String(options.reference);if(reference.value)setRefHa(reference.value);}
    drawGridLayer();grid=cells.length;
    const gridToggle=document.getElementById("togGrid"),waypointToggle=document.getElementById("togWp");
    for(const [toggle,visible,layer] of [[gridToggle,options.gridVisible,DG_GRID_SESSION.getGridLayer()],
     [waypointToggle,options.waypointVisible,DG_GRID_SESSION.getWaypointLayer()]]){
     if(!toggle||visible===undefined)continue;
     toggle.checked=visible!==false;
     if(layer&&toggle.checked&&!map.hasLayer(layer))map.addLayer(layer);
     else if(layer&&!toggle.checked&&map.hasLayer(layer))map.removeLayer(layer);
    }
   }
   return {scan,grid};
  }
 });
 let watching=[],watchedInputs=[],saveTimer=null,workspaceIdentity=null;
 const identity=(projectId,park)=>({ownerId:typeof USER!=="undefined"?USER?.id:null,projectId:Number(projectId),parkId:Number(park?.id||0),geometry:park?.geom_json,engine:typeof DG_LC_ENGINE_VERSION!=="undefined"?DG_LC_ENGINE_VERSION:""});
 async function saveWorkspace(projectId,park,{flush=false}={}){
  if(!projectId||!park||Number(DG_PARK?.id)!==Number(park.id))return true;
  if(typeof dgEnsureLulc==="function"&&!root.DG_LC_SENS?.mount)await dgEnsureLulc();
  const id=identity(projectId,park);if(flush)accountSnapshotStore.markFlush(id);
  return snapshots.save(id);
 }
 function stopWatching(){for(const observer of watching)observer.disconnect();watching=[];
  for(const [element,event,handler] of watchedInputs)element.removeEventListener(event,handler);watchedInputs=[];
  if(saveTimer)clearTimeout(saveTimer);saveTimer=null;workspaceIdentity=null;
 }
 function watchWorkspace(projectId,park){
  stopWatching();workspaceIdentity={projectId,park};
  if(!root.MutationObserver)return;
  const schedule=()=>{if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
   if(Number(DG_PARK?.id)!==Number(park.id)||workspaceIdentity?.projectId!==projectId)return;
   void saveWorkspace(projectId,park).catch(error=>console.warn("DENDROGEO · proje cihaz anlık görüntüsü:",error.message));
  },1300);};
  for(const id of ["gridSummary","lcSens"]){const element=document.getElementById(id);if(!element)continue;
   const observer=new root.MutationObserver(schedule);observer.observe(element,{childList:true,characterData:true,subtree:true});watching.push(observer);
  }
  // Inputs can change without altering DOM text (e.g. grid spacing, brush
  // settings and visibility). Those are also part of the saved work state.
  for(const id of ["lcSens","gridSize","gridClearance","refHa","chkGreenOnly","togGrid","togWp"]){
   const element=document.getElementById(id);if(!element)continue;
   for(const event of ["change","input"]){element.addEventListener(event,schedule);watchedInputs.push([element,event,schedule]);}
  }
 }
 async function restoreWorkspace(project,park){
  if(project.is_locked)return {restored:false,mode:"readonly"};
  // The scan engine version is loaded lazily. Resolve it before comparing
  // historical snapshots; otherwise a fresh tab would always look incompatible.
  if(typeof dgEnsureLulc==="function"&&!root.DG_LC_SENS?.mount)await dgEnsureLulc();
  const id=identity(project.id,park);
  let cached={restored:false,reason:"unavailable"};
  try{cached=await snapshots.restore(id);}catch(error){console.warn("DENDROGEO · proje cihaz arşivi:",error.message);}
  if(cached.scan)return {...cached,mode:"cached"};
  // Account review and same-device drafts are the established, scoped sources.
  // If raster evidence was never cached, recreate it once automatically after
  // the user explicitly opens this project; never silently accept a new result.
  const [local,remote]=await Promise.all([
   root.DG_LC_VALIDATE?.loadCampaigns(park.id).catch(()=>[])||Promise.resolve([]),
   root.DG_SURFACE_REVIEW?.load(park.id,USER.id).catch(()=>null)||Promise.resolve(null)
  ]);
  const drafts=(local||[]).some(row=>String(row.owner)===String(USER.id));
  if(!drafts&&!remote)return {...cached,mode:cached.grid?"cached":"none"};
  const result=await openSurfaceSaved();
  let retainedGrid=cached.grid||0;
  if(result.ready){
   // A legacy grid-only snapshot may have been built against a different
   // surface revision. Restore it only if the review still matches; never
   // overwrite its archived cells with a newly scanned empty grid.
   if(cached.grid){const after=await snapshots.restore(id);retainedGrid=after.grid||0;}
   if(!cached.grid||retainedGrid)await snapshots.save(id);
  }
  return {restored:!!result.restored,scan:!!result.ready,grid:retainedGrid,mode:result.ready?"review":"failed"};
 }
 async function openSurfaceSaved(){return root.DG_LIVE_MAP_PROJECT_SURFACE_UI.restore({
  parkId:Number(DG_PARK?.id||0),currentParkId:()=>Number(DG_PARK?.id||0),
  saveExisting:async()=>{const s=root.DG_LC_SENS?.state;if(!s?.record||!s.editing&&!s.record.draftDirty)return true;return typeof dgSensSave==="function"&&!!(await dgSensSave());},
  scan:()=>runLandCoverAnalysis(),
  hasCells:()=>typeof DG_LC_LAST!=="undefined"&&Array.isArray(DG_LC_LAST?.result?.cells)&&DG_LC_LAST.result.cells.length>0,
  currentRecordParkId:()=>Number(root.DG_LC_SENS?.state?.record?.parkId||0),savedRecord:()=>root.DG_LC_SENS?.state?.record,
  openSavedReview:()=>root.DG_LC_SENS.mount("lcSens",{freshAnalysis:false})
 });}
 function focusPark(){
  if(!map||!PARK_POLY?.length)return;
  // On small screens the expanded stage menu can keep the actual map below
  // the fold. Focus the selected polygon after layout; never change geometry.
  document.getElementById("dgStageToolsMenu")?.removeAttribute("open");
  document.getElementById("map")?.scrollIntoView({block:"start"});
  const fit=()=>{
   if(!map||!PARK_POLY?.length)return;
   map.invalidateSize({pan:false});
   root.DG_PARK_BOUNDARY_LAYER_UI.fit({leaflet:L,map,outer:PARK_POLY,holes:PARK_HOLES||[]});
   PARK_LAYER?.eachLayer?.(layer=>layer.bringToFront?.());
  };
  fit();if(typeof root.requestAnimationFrame==="function")root.requestAnimationFrame(fit);
 }
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&workspaceIdentity)void saveWorkspace(workspaceIdentity.projectId,workspaceIdentity.park,{flush:true}).catch(()=>{});});
 root.DG_LIVE_MAP_PROJECTS=root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI.create({
  document,projects:()=>typeof USER!=="undefined"&&USER&&typeof PROJ_LIST!=="undefined"?PROJ_LIST:[],
  translate:(template,values)=>typeof dgTf==="function"?dgTf(template,values):template,
  remembered:()=>"",remember:()=>{},
  observe:(element,notify)=>{if(typeof root.MutationObserver!=="function")return;const observer=new root.MutationObserver(notify);observer.observe(element,{attributes:true,attributeFilter:["class"]});},
  reloadProjects:()=>loadProjects(),readProject:id=>store.project(id),readPark:id=>store.park(id),readParent:id=>store.parent(id),readParentByKey:key=>store.parentByKey(key),readWaypoints:id=>store.waypoints(id),
  candidate:row=>root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(row),
  activeParkId:()=>typeof DG_PARK!=="undefined"?Number(DG_PARK?.id||0):0,
  activeBoundaryMatches:park=>!!(park?.geom_json?.outer?.length&&map&&PARK_LAYER&&map.hasLayer(PARK_LAYER)&&
   JSON.stringify(PARK_POLY)===JSON.stringify(park.geom_json.outer)&&
   JSON.stringify(PARK_HOLES||[])===JSON.stringify(park.geom_json.inner||[])),
  isEditing:()=>!!(root._dgLandCoverBusy||root.DG_LC_SENS?.state?.busy||root.DG_LC_SENS?.state?.saving||root.DG_LC_SENS?.state?.brush||root.DG_LC_SENS?.state?.draw||root.DG_LC_SENS?.state?.objectPick||root.DG_PARK_STAGES?.isDrawing()||document.querySelector('#dgUxMapTools [data-tool][aria-pressed="true"]')),
  saveDraft:async()=>!root.DG_LC_SENS?.state?.record||typeof dgSensSave!=="function"||!!(await dgSensSave()),
  saveWorkspace:async(projectId,parkId)=>{if(!projectId)return true;return saveWorkspace(projectId,DG_PARK&&Number(DG_PARK.id)===parkId?DG_PARK:null,{flush:true});},
  restoreWorkspace,watchWorkspace,focusPark,stopWatching,
  resumeWatching:()=>{if(workspaceIdentity&&Number(DG_PARK?.id)===Number(workspaceIdentity.park?.id))watchWorkspace(workspaceIdentity.projectId,workspaceIdentity.park);},
  prepareParent:row=>root.DG_PARK_STAGES.present({park:root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(row),row}),
  forgetParent:()=>root.DG_PARK_STAGES.present({park:null,row:null}),
  draw:(candidate,row)=>{
   // The shared drawPark registration hook would otherwise be allowed to
   // insert a park on a key miss (notably for historical manual parks).
   // Resolve the *already verified* row from the existing session cache;
   // this project-opening path must never create a second park identity.
   if(!candidate.stageRow){
    const center=dgParkCenter(candidate,{});
    const key=candidate.source==="manual"
     ?dgManualParkKey(candidate.name,center.lat,center.lon)
     :dgParkKey(candidate.type,candidate.id);
    if(!key||!DG_PARK_SESSION?.set)throw Error("Kayıtlı park kimliği güvenle yüklenemedi.");
    DG_PARK_SESSION.set(key,row);
   }
   return drawPark(candidate);
  },
  showWaypoints:rows=>{
   const previous=DG_GRID_SESSION.getWaypointLayer();
   const layer=root.DG_GRID_WAYPOINT_LAYER.render({map,previousLayer:previous,rows,leaflet:L});
   DG_GRID_SESSION.setWaypointLayer(layer);LAST_WP_ROWS=rows;
  },
  clearWaypoints:()=>{const layer=DG_GRID_SESSION.getWaypointLayer();if(layer&&map)map.removeLayer(layer);DG_GRID_SESSION.setWaypointLayer(null);LAST_WP_ROWS=[];},
  selectProject:setSelect,openWaypoints,
  openSurface:async()=>{
   const current=Number(DG_PARK?.id||0),record=root.DG_LC_SENS?.state?.record;
   if(Number(record?.parkId)===current&&DG_LC_LAST?.result?.cells?.length){document.getElementById("lcSens")?.scrollIntoView({block:"nearest"});return {ready:true,restored:true};}
   const result=await openSurfaceSaved();if(result.ready&&workspaceIdentity)await saveWorkspace(workspaceIdentity.projectId,workspaceIdentity.park,{flush:true});
   return result;
  },
  openStages
 });
})(window);
