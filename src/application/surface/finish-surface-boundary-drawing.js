"use strict";

/* Persist the boundary to the local draft, then run required water review. */
window.DG_FINISH_SURFACE_BOUNDARY_DRAWING={
  finish({draw,prepare,showInvalid,showClipError,showOutside,record,timestamp,markDirty,cancel,continueDrawing,renderTools,repartition,save,needsWaterScan,setStatus,updateStatus,scan,translate}){
    if(!draw)return;
    const prepared=prepare(draw.ring);
    if(prepared.kind==="invalid-ring"){showInvalid();return;}
    if(prepared.kind==="clip-error"){showClipError(prepared.error);return;}
    if(prepared.kind!=="ready"){showOutside();return;}
    const feature={type:draw.type,ring:draw.ring.map(point=>point.slice()),method:"visual-boundary",ts:timestamp()};
    const draft=record();draft.features.push(feature);markDirty();if(!continueDrawing)cancel();renderTools();
    return repartition().then(async ok=>{
      if(!ok){if(continueDrawing&&record()===draft){const index=draft.features.indexOf(feature);if(index>=0)draft.features.splice(index,1);markDirty();renderTools();}return false;}
      await save();
      if(continueDrawing)continueDrawing(draw);
      if(feature.type==="water"&&needsWaterScan()){
        setStatus(translate("Su sınırı dışındaki raster hücreleri güncel uydu verisiyle sınıflandırılıyor…"));updateStatus();await scan();
      }
      return true;
    });
  }
};
