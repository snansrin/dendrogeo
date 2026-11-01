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
 const snapshots=root.DG_LIVE_MAP_PROJECT_SNAPSHOT.create({
  store:root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE.create(()=>root.indexedDB),
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
 async function saveWorkspace(projectId,park){
  if(!projectId||!park||Number(DG_PARK?.id)!==Number(park.id))return true;
  if(typeof dgEnsureLulc==="function"&&!root.DG_LC_SENS?.mount)await dgEnsureLulc();
  return snapshots.save(identity(projectId,park));
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
  // Never initiate a fresh raster calculation while reopening a saved project.
  // Historical edits can only be reviewed against their original evidence.
  // A saved review without a portable raster is reported, not recalculated.
  const [local,remote]=await Promise.all([
   root.DG_LC_VALIDATE?.loadCampaigns(park.id).catch(()=>[])||Promise.resolve([]),
   root.DG_SURFACE_REVIEW?.load(park.id,USER.id).catch(()=>null)||Promise.resolve(null)
  ]);
  const drafts=(local||[]).some(row=>String(row.owner)===String(USER.id));
  return {...cached,mode:drafts||remote?"evidence-missing":cached.grid?"cached":"none"};
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
  if(!map||!PARK_POLY?.length||!Number(DG_PARK?.id))return;
  const selected=workspaceIdentity;
  if(selected&&Number(DG_PARK.id)!==Number(selected.park.id))return;
  // On mobile the project details and the eight GIS controls may push the
  // actual Leaflet map below the viewport. Bring the map itself into view.
  document.getElementById("map")?.scrollIntoView({block:"start"});
  const repaint=()=>{
   if(selected&&Number(DG_PARK?.id)!==Number(selected.park.id))return;
   map.invalidateSize({pan:false});
   // Recover the *display layer* if another menu removed it. The verified
   // saved geometry/park identity remains authoritative and unchanged.
   if(!PARK_LAYER||!map.hasLayer(PARK_LAYER)){
    root.DG_PARK_BOUNDARY_LAYER_UI.render({leaflet:L,map,outer:PARK_POLY,holes:PARK_HOLES||[],
     onCreated:layer=>{PARK_LAYER=layer;}});
   }
   if(typeof PARK_LAYER?.eachLayer==="function")PARK_LAYER.eachLayer(layer=>layer.bringToFront?.());
   root.DG_PARK_BOUNDARY_LAYER_UI.fit({leaflet:L,map,outer:PARK_POLY,holes:PARK_HOLES||[]});
  };
  if(typeof root.requestAnimationFrame==="function")root.requestAnimationFrame(repaint);
  else repaint();
 }
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&workspaceIdentity)void saveWorkspace(workspaceIdentity.projectId,workspaceIdentity.park).catch(()=>{});});
 root.DG_LIVE_MAP_PROJECTS=root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI.create({
  document,projects:()=>typeof USER!=="undefined"&&USER&&typeof PROJ_LIST!=="undefined"?PROJ_LIST:[],
  translate:(template,values)=>typeof dgTf==="function"?dgTf(template,values):template,
  remembered:()=>"",remember:()=>{},
  observe:(element,notify)=>{if(typeof root.MutationObserver!=="function")return;const observer=new root.MutationObserver(notify);observer.observe(element,{attributes:true,attributeFilter:["class"]});},
  reloadProjects:()=>loadProjects(),readProject:id=>store.project(id),readPark:id=>store.park(id),readParent:id=>store.parent(id),readParentByKey:key=>store.parentByKey(key),readWaypoints:id=>store.waypoints(id),
  candidate:row=>root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(row),
  activeParkId:()=>typeof DG_PARK!=="undefined"?Number(DG_PARK?.id||0):0,
  isEditing:()=>!!(root._dgLandCoverBusy||root.DG_LC_SENS?.state?.busy||root.DG_LC_SENS?.state?.saving||root.DG_LC_SENS?.state?.brush||root.DG_LC_SENS?.state?.draw||root.DG_LC_SENS?.state?.objectPick||root.DG_PARK_STAGES?.isDrawing()||document.querySelector('#dgUxMapTools [data-tool][aria-pressed="true"]')),
  saveDraft:async()=>!root.DG_LC_SENS?.state?.record||typeof dgSensSave!=="function"||!!(await dgSensSave()),
  saveWorkspace:async(projectId,parkId)=>{if(!projectId)return true;return saveWorkspace(projectId,DG_PARK&&Number(DG_PARK.id)===parkId?DG_PARK:null);},
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
   const result=await openSurfaceSaved();if(result.ready&&workspaceIdentity)await saveWorkspace(workspaceIdentity.projectId,workspaceIdentity.park);
   return result;
  },
  openStages
 });
})(window);
