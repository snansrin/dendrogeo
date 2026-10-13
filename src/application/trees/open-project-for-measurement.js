"use strict";

/* Preserve the existing project-to-measure navigation and delayed form update. */
window.DG_OPEN_PROJECT_FOR_MEASUREMENT={
  open(id,ports){
    const project=(ports.projects()||[]).find(row=>Number(row.id)===Number(id));if(!project)return null;
    ports.remember(id);ports.go("measure");
    ports.schedule(()=>{
      const select=ports.measureSelect();if(select)select.value=String(id);
      if(ports.projectChanged)ports.projectChanged();
      if(ports.parkGate)ports.parkGate();
    },80);
    return project;
  }
};
