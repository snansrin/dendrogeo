"use strict";

/* Place the editor beside the shared map and keep Leaflet dimensions current. */
window.DG_MOUNT_SURFACE_REVIEW_MAP_HOST={
  mount({host,document,map,state,baselineLayer,switchBaseLayer,ResizeObserverCtor}){
    state.hostParent=host.parentNode;state.hostNext=host.nextSibling;
    const mapEl=document.getElementById("map");
    if(mapEl){(document.getElementById("surfaceMapWorkspace")||mapEl).after(host);mapEl.classList.add("surface-review-map");}
    host.style.display="block";
    if(baselineLayer&&map.hasLayer(baselineLayer)){state.baselineShown=true;map.removeLayer(baselineLayer);}
    state.base=document.getElementById("baseLayerSelect")?.value||state.base;
    if(typeof switchBaseLayer==="function")switchBaseLayer(state.base);
    document.getElementById("v-map")?.classList.add("surface-review-active");
    map.invalidateSize({pan:false});
    if(ResizeObserverCtor&&mapEl){state.resizeObserver?.disconnect();state.resizeObserver=new ResizeObserverCtor(()=>map.invalidateSize({pan:false}));state.resizeObserver.observe(mapEl);}
  }
};
