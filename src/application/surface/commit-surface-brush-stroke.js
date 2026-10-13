"use strict";

/* Record a completed brush stroke and persist it through the existing draft path. */
window.DG_COMMIT_SURFACE_BRUSH_STROKE={
  async commit({points,type,diameter,state,types,allowed,validate,selectCells,cells,cellKey,createDecision,appendHistory,timestamp,strokeId,dirty,refresh,summary,status,save}){
    if(!validate({points,type,diameter,types,allowed})||!state.record||state.rawView||state.busy||state.saving)return;
    const record=state.record,keys=selectCells(points,diameter);if(!keys.length)return;
    const ts=timestamp(),id=strokeId(),changes=[],cellByKey=new Map((cells()||[]).map(cell=>[cellKey(cell),cell]));
    for(const key of keys){const cell=cellByKey.get(key);if(!cell)continue;const previous=record.corrections?.[key]?{...record.corrections[key]}:null,applied=createDecision(cell,type,ts,id);if(applied)changes.push({key,before:previous,strokeId:id});}
    if(!changes.length)return;
    appendHistory(record,{id,changes,ts,type,diameter_m:diameter});dirty();refresh();summary();status();if(state.record===record)await save();
  }
};
