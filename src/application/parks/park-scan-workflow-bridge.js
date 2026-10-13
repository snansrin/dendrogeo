"use strict";
/* Wire the isolated scan workflows to the locked park-registry globals. */
(function(root){
  root.startParkScan=function(options){
    return root.DG_START_PARK_SCAN.start(options,{
      setActive:value=>{DG_PARK_SCAN=value;},setTargetProject:value=>{DG_PARK_TARGET_PROJ=value;},setReturnTo:value=>{DG_PARK_RETURN_TO=value;},
      go:view=>{if(typeof go==="function")go(view);},parkMode:()=>typeof PARK_MODE!=="undefined"&&PARK_MODE,
      toggleParkMode:()=>{if(typeof toggleParkMode==="function")toggleParkMode();},schedule:(fn,delay)=>setTimeout(fn,delay),
      map:()=>typeof map!=="undefined"?map:null,
      focusTarget:()=>root.DG_FOCUS_PARK_SCAN_TARGET.focus(DG_PARK_TARGET_PROJ,{
        map:()=>typeof map!=="undefined"?map:null,
        readProjectMeasurements:projectId=>sb.from("measurements").select("lat,lon").eq("project_id",projectId).limit(500),
        bounds:points=>L.latLngBounds(points),gps:()=>typeof GPS!=="undefined"?GPS:null
      }),
      render:()=>dgRenderScanCard(),card:()=>$("parkScanCard"),notify:(...args)=>toast(...args)
    });
  };
  root.dgFocusScanTarget=function(){
    return root.DG_FOCUS_PARK_SCAN_TARGET.focus(DG_PARK_TARGET_PROJ,{
      map:()=>typeof map!=="undefined"?map:null,
      readProjectMeasurements:projectId=>sb.from("measurements").select("lat,lon").eq("project_id",projectId).limit(500),
      bounds:points=>L.latLngBounds(points),gps:()=>typeof GPS!=="undefined"?GPS:null
    });
  };
  root.dgScanStep=()=>root.DG_SELECT_PARK_SCAN_STEP.select(DG_PARK,DG_PARK_CAND);
  root.dgScanPreviewName=()=>root.DG_PREVIEW_PARK_PROJECT_NAME.update($("scanNamePreview"),$("scanLabel"),DG_PARK,DG_PARK_CAND,dgProjectName);
  root.dgCancelScan=()=>root.DG_CANCEL_PARK_SCAN.cancel({
    setActive:value=>{DG_PARK_SCAN=value;},setTargetProject:value=>{DG_PARK_TARGET_PROJ=value;},returnTo:()=>DG_PARK_RETURN_TO,
    setReturnTo:value=>{DG_PARK_RETURN_TO=value;},render:()=>dgRenderScanCard(),go:view=>{if(typeof go==="function")go(view);}
  });
})(window);
