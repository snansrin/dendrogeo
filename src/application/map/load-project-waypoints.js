"use strict";

window.DG_LOAD_PROJECT_WAYPOINTS={
  async load({projectId,getProjectId,previousTarget,reset,readProject,selectTarget,setWaypoints,setTarget,draw,showError}){
    reset();
    if(!projectId)return;
    try{
      const{data,error}=await readProject(projectId);
      if(getProjectId()!==projectId)return;
      if(error)throw error;
      const waypoints=data||[];
      setWaypoints(waypoints);
      setTarget(selectTarget(waypoints,previousTarget));
      draw();
    }catch(error){showError(error);}
  }
};
