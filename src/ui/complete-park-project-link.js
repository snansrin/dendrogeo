"use strict";

/* Finish the project-link handoff only after refreshing the project choices. */
window.DG_COMPLETE_PARK_PROJECT_LINK={
  async complete(project,ports){
    if(ports.loadProjects)await ports.loadProjects();
    const measurement=ports.element("mProject");
    if(measurement&&project){
      measurement.value=String(project.id);
      if(ports.refreshGate)ports.refreshGate();
    }
    const nextMeasurement=ports.element("nProject");
    if(nextMeasurement&&project)nextMeasurement.value=String(project.id);

    const back=ports.getReturnTo();
    ports.setScanActive(false);
    ports.setTargetProject(null);
    ports.setReturnTo(null);
    ports.renderCard();
    if(back&&ports.go)ports.go(back);
  }
};
