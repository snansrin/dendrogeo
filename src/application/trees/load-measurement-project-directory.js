"use strict";

/* Orchestrate project reads, scoped observable state and directory presentation. */
const DG_MEASUREMENT_PROJECT_DIRECTORY_STATE=window.DG_MEASUREMENT_PROJECT_STATE.create();
window.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE=DG_MEASUREMENT_PROJECT_DIRECTORY_STATE;
window.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY={
  async load(ports){
    const unsubscribe=ports.onState?DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.subscribe(ports.onState):()=>{};
    DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.setState({loading:true,error:null});
    try{
      const owned=await ports.fetchOwned();
      const shared=await ports.fetchShared(owned);
      const projects=ports.merge(owned,shared);
      DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.setState({projects,loading:false,error:null});
      ports.render(projects);
      ports.afterRender(projects);
      return projects;
    }catch(error){
      DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.setState({loading:false,error});
      throw error;
    }finally{unsubscribe();}
  }
};
