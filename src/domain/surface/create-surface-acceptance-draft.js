"use strict";

/* Freeze the currently reviewed edits and areas into an acceptance candidate. */
window.DG_CREATE_SURFACE_ACCEPTANCE_DRAFT={
  create({record,cells,cellKey,effectiveClass,editSummary,areas,timestamp}){
    const snapshot=JSON.parse(JSON.stringify(record));
    // Preserve geometry identities so acceptance cannot invalidate the partition cache.
    snapshot.features=record.features;snapshot.objectFeatures=record.objectFeatures;
    for(const cell of cells||[]){const key=cellKey(cell);if(snapshot.corrections[key]?.method!=="visual-cell")snapshot.corrections[key]={from:cell.classKey,to:effectiveClass(cell),method:"sensitivity",ts:timestamp()};}
    snapshot.editSummary=editSummary(snapshot);snapshot.draftDirty=false;snapshot.acceptedAreas=areas();snapshot.acceptedAt=timestamp();snapshot.modifiedAt=snapshot.acceptedAt;
    return snapshot;
  }
};
