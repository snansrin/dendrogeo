"use strict";

/* Orchestrate project reads, scoped observable state and directory presentation. */
const DG_MEASUREMENT_PROJECT_DIRECTORY_STATE=window.DG_MEASUREMENT_PROJECT_STATE.create();
window.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE=DG_MEASUREMENT_PROJECT_DIRECTORY_STATE;
let directoryEpoch=0,directoryScope=null;
window.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY={
  async load(ports){
    const epoch=++directoryEpoch,scope=ports.scope||null;
    const current=()=>epoch===directoryEpoch&&(!ports.isCurrent||ports.isCurrent());
    const update=patch=>{const state=DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.setState(patch);ports.onState?.(state);};
    const changed=directoryScope!==scope;directoryScope=scope;
    update({...(changed?{projects:[]}:{}),loading:true,error:null});
    const previous=DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().projects;
    let owned=previous.filter(row=>!row.shared),shared=previous.filter(row=>row.shared),succeeded=0;
    const failures=[];
    try{owned=await ports.fetchOwned();succeeded++;}catch(error){failures.push({source:"owned",error});}
    if(!current())return null;
    try{shared=await ports.fetchShared(owned);succeeded++;}catch(error){failures.push({source:"shared",error});}
    if(!current())return null;
    const projects=ports.merge(owned,shared);
    const error=failures.length?Object.assign(new Error(failures.map(item=>item.source+": "+(item.error?.message||"Read failed")).join("; ")),{failures}):null;
    update({projects,loading:false,error});
    // The two reads are separate sources. A sharing/Auth outage must not
    // prevent successful owned rows from reaching the UI (and vice versa).
    ports.render(projects);
    ports.afterRender(projects);
    if(error){ports.onError?.(error);if(!succeeded)throw error;}
    return projects;
  }
};
