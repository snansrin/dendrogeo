"use strict";

/* Keep the composite project/waypoint key used by the existing upsert contract. */
window.DG_BUILD_WAYPOINT_UPSERT_COMMAND={
  build({owner,projectId,waypoint}){return{row:{owner,project_id:projectId,wp_id:waypoint.id,lat:waypoint.lat,lon:waypoint.lon},options:{onConflict:"project_id,wp_id"}};}
};
