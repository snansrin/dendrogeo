"use strict";

/* Keep brush undo bounded and restore only decisions still owned by that stroke. */
window.DG_SURFACE_BRUSH_HISTORY={
  append(record,stroke){
    if(!Array.isArray(record.brushHistory))record.brushHistory=[];
    record.brushHistory.push(stroke);
    if(record.brushHistory.length>20)record.brushHistory.splice(0,record.brushHistory.length-20);
  },
  undoLatest(record){
    const history=Array.isArray(record.brushHistory)?record.brushHistory:[],stroke=history.pop();
    record.brushHistory=history;if(!stroke)return false;
    let changed=false;
    for(const entry of [...stroke.changes].reverse()){
      const current=record.corrections?.[entry.key];if(current?.brushStrokeId!==entry.strokeId)continue;
      if(entry.before)record.corrections[entry.key]=entry.before;else delete record.corrections[entry.key];
      changed=true;
    }
    return changed;
  }
};
