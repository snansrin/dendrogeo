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
  const box=document.getElementById("dgParkStageWorkspace");
  if(box){box.scrollIntoView({behavior:"smooth",block:"nearest"});box.querySelector("#dgStageSelect")?.focus({preventScroll:true});}
  else document.getElementById("parkInfo")?.scrollIntoView({behavior:"smooth",block:"nearest"});
 }
 root.DG_LIVE_MAP_PROJECTS=root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI.create({
  document,projects:()=>typeof USER!=="undefined"&&USER&&typeof PROJ_LIST!=="undefined"?PROJ_LIST:[],
  remembered:()=>{try{return localStorage.getItem(key())||"";}catch(error){return"";}},
  remember:id=>{try{localStorage.setItem(key(),String(id));}catch(error){}},
  observe:(element,notify)=>{if(typeof root.MutationObserver!=="function")return;const observer=new root.MutationObserver(notify);observer.observe(element,{attributes:true,attributeFilter:["class"]});},
  reloadProjects:()=>loadProjects(),readProject:id=>store.project(id),readPark:id=>store.park(id),readWaypoints:id=>store.waypoints(id),
  candidate:row=>root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(row),
  activeParkId:()=>typeof DG_PARK!=="undefined"?Number(DG_PARK?.id||0):0,
  isEditing:()=>!!(root._dgLandCoverBusy||root.DG_LC_SENS?.state?.busy||root.DG_LC_SENS?.state?.saving||root.DG_LC_SENS?.state?.brush||root.DG_LC_SENS?.state?.draw||root.DG_LC_SENS?.state?.objectPick||root.DG_PARK_STAGES?.isDrawing()||document.querySelector('#dgUxMapTools [data-tool][aria-pressed="true"]')),
  saveDraft:async()=>!root.DG_LC_SENS?.state?.record||typeof dgSensSave!=="function"||!!(await dgSensSave()),
  prepareParent:row=>root.DG_PARK_STAGES.present({park:root.DG_LIVE_MAP_PROJECT_CANDIDATE.candidate(row),row}),
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
  openSurface:()=>{if(typeof runLandCoverAnalysis==="function")void runLandCoverAnalysis();else document.getElementById("landCoverBtn")?.click();},
  openStages
 });
})(window);
