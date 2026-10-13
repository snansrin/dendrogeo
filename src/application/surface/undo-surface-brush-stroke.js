"use strict";

/* Undo the most recent brush stroke only where that stroke still owns a decision. */
window.DG_UNDO_SURFACE_BRUSH_STROKE={
  undo({record,rawView,busy,saving,historyModule,dirty,refresh,summary,status,save}){
    if(!record||rawView||busy||saving)return false;
    let changed=false;
    if(historyModule)changed=historyModule.undoLatest(record);
    else{
      const history=Array.isArray(record.brushHistory)?record.brushHistory:[],stroke=history.pop();record.brushHistory=history;if(!stroke)return false;
      for(const entry of [...stroke.changes].reverse()){const current=record.corrections?.[entry.key];if(current?.brushStrokeId!==entry.strokeId)continue;if(entry.before)record.corrections[entry.key]=entry.before;else delete record.corrections[entry.key];changed=true;}
    }
    if(changed){dirty();refresh();summary();status();save();}return changed;
  }
};
