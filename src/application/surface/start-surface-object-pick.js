"use strict";
window.DG_START_SURFACE_OBJECT_PICK={async start({state,data,boundary,hasStored,guard,stopBrush,cancelDraw,cancelObject,map,onPick,renderTools,updateStatus,toast,unavailableMessage,promptMessage,loadCoverage,getData,isCurrent=()=>true,closeMenus=()=>{},loadingMessage}){
 if(state.rawView||state.busy||state.saving||state.exporting||state.objectPickLoading)return;
 if((!data||data.boundary!==boundary)&&!hasStored&&loadCoverage){
  state.objectPickLoading=true;
  if(loadingMessage){state.status=loadingMessage;updateStatus();toast(loadingMessage,"info");}
  try{await loadCoverage();data=getData?.();}catch(error){}
  finally{state.objectPickLoading=false;}
  if(!isCurrent()||state.rawView||state.busy||state.saving||state.exporting)return;
 }
 if((!data||data.boundary!==boundary)&&!hasStored){toast(unavailableMessage,"warn");return;}
 stopBrush();cancelDraw();cancelObject();state.objectPick=true;guard(true);state.status=promptMessage;map.on("click",onPick);renderTools();closeMenus();updateStatus();
}};
