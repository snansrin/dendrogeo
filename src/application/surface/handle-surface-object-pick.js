"use strict";

/* Turn a map click into either an actionable OSM boundary preview or the existing guidance. */
window.DG_HANDLE_SURFACE_OBJECT_PICK={
  handle({event,picking,find,onError,onMissing,removeClick,setPreview,setDrawType,renderPreview,renderTools,openBoundaryMenu,updateStatus,toast}){
    if(!picking||!event?.latlng)return;
    let result=null;try{result=find(event.latlng);}catch(e){toast(onError(),"warn");return;}
    if(!result){toast(onMissing(),"info");return;}
    removeClick();setPreview(result);setDrawType(result.type);renderPreview(result);renderTools();openBoundaryMenu();updateStatus();
  }
};
