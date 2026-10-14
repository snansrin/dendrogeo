"use strict";

/* Orchestrate async display geometry, stale-result rejection and layer visibility. */
window.DG_REFRESH_SURFACE_REVIEW_LAYER={
  async refresh({state,map,leafletReady,createLayer,createRenderer,createPathCache,buildKey,isCurrent,parts,visualResult,mergeSync,displaySync,renderPolygons,renderBoundary,renderVegetation,clearPreview,updateStatus,schedule,refresh,onError,epsg,parkGeometry}){
    if(!map||!leafletReady||!state.record||!state.geometry)return;
    if(!state.layer){state.layer=createLayer(map);state.renderer=createRenderer();state.pathCache=createPathCache();}
    if(!state.showCand){state.layer.clearLayers();clearPreview?.();if(state.boundaryLayer)map.removeLayer(state.boundaryLayer);state.boundaryLayer=null;return;}
    const key=buildKey(state);
    if(state.mergedKey!==key){
      if(state.mergeBusy)return;
      const epoch=state.epoch;state.mergeBusy=true;updateStatus();
      try{
        const resolvedParts=parts(),job=await visualResult(resolvedParts);
        if(!isCurrent({state,epoch,key,buildKey}))return;
        state.mergedFeatures=job?.features||mergeSync(resolvedParts,epsg);state.mergedKey=key;state.layer.clearLayers();
        state.displayFeatures=job?.displayFeatures||displaySync(resolvedParts,epsg,parkGeometry);
        renderPolygons({features:state.displayFeatures,state,epoch,geometry:state.geometry});
      }catch(error){if(epoch===state.epoch)onError(String(error.message||error));}
      finally{state.mergeBusy=false;updateStatus();if(epoch===state.epoch&&!isCurrent({state,epoch,key,buildKey}))schedule(refresh);}
      if(!isCurrent({state,epoch,key,buildKey})){if(state.record)schedule(refresh);return;}
    }
    if(!state.showCand){state.layer?.clearLayers();state.vegetationLayer?.clearLayers();if(state.boundaryLayer)map.removeLayer(state.boundaryLayer);state.boundaryLayer=null;state.boundaryKey=null;return;}
    for(const path of state.displayPaths||[]){
      path.poly.setStyle({fillOpacity:state.opacity/100});
      const visible=(!state.focus||path.cls===state.focus)&&!(state.vegetationView&&path.cls==="green");
      if(visible){if(!state.layer.hasLayer(path.poly))path.poly.addTo(state.layer);}else state.layer.removeLayer(path.poly);
    }
    clearPreview?.();
    renderBoundary();if(state.vegetationView)renderVegetation();else state.vegetationLayer?.clearLayers();
  }
};
