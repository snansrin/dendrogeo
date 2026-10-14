"use strict";
/* Own UI teardown and park-mode transitions; persistence remains outside this module. */
window.DG_SURFACE_EDITOR_LIFECYCLE={
 parkMode({state,stopBrush,cancelDraw,cancelObject,parkMode,toggleParkMode,render}){stopBrush();if(state.draw)cancelDraw();cancelObject();if(!parkMode())toggleParkMode();render();},
 cleanup({state,map,document,stopBrush,unbindRightPan,cancelObject,cancelJobs,clearTimer,cancelDraw,refreshLayer,clearMenus,guard}){
 stopBrush();unbindRightPan();cancelObject();state.editView=null;state.rawView=false;++state.epoch;cancelJobs();clearTimer(state.debounce);clearTimer(state.saveTimer);state.debounce=null;state.resizeObserver?.disconnect();state.resizeObserver=null;
 if(map){if(state.layer)map.removeLayer(state.layer);if(state.boundaryLayer)map.removeLayer(state.boundaryLayer);if(state.vegetationLayer)map.removeLayer(state.vegetationLayer);if(state.renderer)map.removeLayer(state.renderer);state.layer=null;state.boundaryLayer=null;state.boundaryKey=null;state.vegetationLayer=null;state.renderer=null;state.pathCache=null;cancelDraw();map.off("moveend",refreshLayer);}
 const host=document.getElementById("lcSens");if(host){host.style.display="none";host.innerHTML="";if(state.hostParent?.isConnected)state.hostParent.insertBefore(host,state.hostNext?.parentNode===state.hostParent?state.hostNext:null);else host.remove();}
 document.getElementById("map")?.classList.remove("surface-review-map");
 document.getElementById("v-map")?.classList.remove("surface-review-active");
 const pending=document.getElementById("surfacePendingTools");if(pending)pending.style.display="none";
 clearMenus("surface");
 for(const id of ["surfaceBrushTools","surfaceMapTools"]){const paint=document.getElementById(id);if(paint)paint.innerHTML="";}
 if(map?.invalidateSize)map.invalidateSize({pan:false});
 Object.assign(state,{record:null,layer:null,boundaryLayer:null,boundaryKey:null,geometry:null,parkGeometry:null,busy:false,saving:false,exporting:false,baselineShown:false,baselineReport:null,mergedKey:null,mergedFeatures:null,displayPaths:null,hostParent:null,hostNext:null});
 state.partsMemo=null;state.visualMemo=null;
 guard(false); /* 0056: park kapandı — algılama serbest */
}
};
