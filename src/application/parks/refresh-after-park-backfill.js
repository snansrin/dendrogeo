"use strict";

/* Refresh the same legacy summaries after either backfill write path. */
window.DG_REFRESH_AFTER_PARK_BACKFILL={
  refresh(ports){
    if(ports.loadProjects)ports.loadProjects();
    if(ports.loadWorld)ports.loadWorld();
    if(ports.loadAdmin)ports.loadAdmin();
  }
};
