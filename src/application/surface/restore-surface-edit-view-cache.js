"use strict";

/* Reuse an unchanged prepared edit partition without clipping it a second time. */
window.DG_RESTORE_SURFACE_EDIT_VIEW_CACHE={
  async restore({state,record,epoch,prepared,map,removeLayer,render,refresh}){
    state.busy=true;
    try{
      if(state.layer)removeLayer(map,state.layer);if(state.renderer)removeLayer(map,state.renderer);
      state.layer=null;state.renderer=null;state.mergedKey=null;state.displayPaths=[];
      state.geometry=prepared.geometry;state.parkGeometry=prepared.parkGeometry;state.partitionVersion=prepared.partitionVersion;state.visualMemo=prepared.visualMemo;state.partsMemo=null;
      render();await refresh();
    }finally{if(epoch===state.epoch&&state.record===record){state.busy=false;state.editView=null;render();}}
  }
};
