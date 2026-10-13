"use strict";

/* Build the existing project park link and its canonical legacy-derived label. */
window.DG_BUILD_BACKFILL_PROJECT_LINK={
  build(project,park){
    return{park_id:park.id,label:window.DG_PARK_IDENTITY.labelFromLegacy(project.name,park.name)};
  }
};
