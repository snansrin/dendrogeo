"use strict";

/* Build the established visual-cell correction without changing its schema. */
window.DG_SURFACE_CELL_DECISION={
  create({cell,toClass,types,timestamp,strokeId=null,cellKey}){
    if(!cell||!types?.[toClass])return null;
    if(toClass==="pool")toClass="water";
    const key=cellKey(cell),decision={from:cell.classKey,to:toClass,method:"visual-cell",ts:timestamp};
    if(strokeId)decision.brushStrokeId=strokeId;
    return{key,decision};
  }
};
