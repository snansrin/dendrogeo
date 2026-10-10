"use strict";

/* Stop an async waypoint insert flow when any source context has changed. */
function dgIsGridWaypointContextCurrent({ source, park, projectId, getReviewSignature, getGridSource, getPark, getProjectId }) {
  if (source !== getReviewSignature()) return false;
  if (source !== getGridSource()) return false;
  if (park !== getPark()) return false;
  if (projectId !== getProjectId()) return false;
  return true;
}

window.DG_GRID_WAYPOINT_CONTEXT = Object.freeze({ isCurrent: dgIsGridWaypointContextCurrent });
