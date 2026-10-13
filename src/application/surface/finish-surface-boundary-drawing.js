"use strict";

/* Persist the boundary to the local draft, then run required water review. */
window.DG_FINISH_SURFACE_BOUNDARY_DRAWING={
  finish({draw,prepare,showInvalid,showClipError,showOutside,record,timestamp,markDirty,cancel,renderTools,repartition,save,needsWaterScan,setStatus,updateStatus,scan,translate}){
    if(!draw)return;
    const prepared=prepare(draw.ring);
    if(prepared.kind==="invalid-ring"){showInvalid();return;}
    if(prepared.kind==="clip-error"){showClipError(prepared.error);return;}
    if(prepared.kind!=="ready"){showOutside();return;}
    record().features.push({...draw,method:"visual-boundary",ts:timestamp()});markDirty();cancel();renderTools();
    return repartition().then(async ok=>{
      if(!ok)return;
      await save();
      if(draw.type==="water"&&needsWaterScan()){
        setStatus(translate("Su sınırı dışındaki raster hücreleri güncel uydu verisiyle sınıflandırılıyor…"));updateStatus();await scan();
      }
    });
  }
};
