"use strict";

window.DG_SYNC_BASE_MAP_LAYER_SELECTION={
  sync({type,getElement,setSurfaceBase}){
    for(const id of ["baseLayerSelect","dgSensBaseSelect","dgPendingBaseSelect"]){const element=getElement(id);if(element)element.value=type;}
    setSurfaceBase(type);
  }
};
