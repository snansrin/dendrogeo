"use strict";

/* Count user-visible edits without mutating the record or source raster. */
window.DG_SUMMARIZE_SURFACE_EDIT_IMPACT={
  summarize({record,currentRecord,cells,rawView,classes,cellKey,effective}){
    if(rawView||!record)return{total:0,manualCells:0,sensitivityCells:0,boundaries:0,thresholds:0,appearance:0};
    const manualCells=Object.values(record.corrections||{}).filter(decision=>decision.method==="visual-cell").length;
    const sensitivityCells=cells.filter(cell=>{const decision=record.corrections?.[cellKey(cell)];if(decision?.method==="visual-cell")return false;const type=record===currentRecord?effective(cell):(decision?.to||cell.rasterClassKey||cell.classKey);return type!==(cell.rasterClassKey||cell.classKey);}).length;
    const boundaries=(record.features||[]).length,thresholds=classes.filter(key=>Number(record.sens?.[key]??50)!==50).length,appearance=Number(record.displayOpacity??45)!==45?1:0;
    return{manualCells,sensitivityCells,boundaries,thresholds,appearance,total:manualCells+sensitivityCells+boundaries+thresholds+appearance};
  }
};
