"use strict";

/* Prepare the existing cell correction choices without HTML or Leaflet state. */
window.DG_SURFACE_CELL_DECISION_POPUP_MODEL={
  build({cell,key,currentClass,decision,meta}){
    if(!cell)return null;
    return{key,currentClass:currentClass==="pool"?"water":currentClass,areaM2:Number(cell.areaM2),description:"Görüntüdeki sınıfı seçerek bu hücreyi düzeltin.",options:["green","hard","building","water","bare"].map(classKey=>({classKey,emoji:meta(classKey).emoji,label:meta(classKey).tr,selected:classKey===(currentClass==="pool"?"water":currentClass)})),canUndo:!!decision};
  }
};
