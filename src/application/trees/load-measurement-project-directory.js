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
    try{
      const owned=await ports.fetchOwned();
      if(!current())return null;
      const shared=await ports.fetchShared(owned);
      if(!current())return null;
      const projects=ports.merge(owned,shared);
      update({projects,loading:false,error:null});
      ports.render(projects);
      ports.afterRender(projects);
      return projects;
    }catch(error){
      if(!current())return null;
      update({loading:false,error});
      ports.onError?.(error);
      throw error;
    }
  }
};
