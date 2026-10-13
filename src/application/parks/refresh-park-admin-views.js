"use strict";

/* Refresh the park admin screen first, then the other legacy summary panels. */
window.DG_REFRESH_PARK_ADMIN_VIEWS={
  async refresh(ports){
    await ports.loadParkAdmin();
    if(ports.loadProjects)ports.loadProjects();
    if(ports.loadWorld)ports.loadWorld();
    if(ports.loadAdminTree)ports.loadAdminTree();
  }
};
