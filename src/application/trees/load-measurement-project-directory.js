"use strict";

/* Orchestrate project reads, merge and directory presentation. */
window.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY={
  async load(ports){
    const owned=await ports.fetchOwned();
    const shared=await ports.fetchShared(owned);
    const projects=ports.merge(owned,shared);
    ports.setProjects(projects);
    ports.render(projects);
    ports.afterRender(projects);
    return projects;
  }
};
