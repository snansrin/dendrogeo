"use strict";

window.DG_DELETE_PROJECT_WAYPOINTS_USE_CASE={
  async execute({projectId,isSelected,confirmDeletion,remove,showError,complete,notify}){
    if(!isSelected(projectId)){notify("Proje seç");return;}
    if(!confirmDeletion())return;
    const{error}=await remove(projectId);
    if(error){showError(error);return;}
    complete();
  }
};
