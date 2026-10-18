"use strict";

/* Assemble the existing grid-worker request from resolved park and surface inputs. */
function dgBuildGridRequest(input) {
  const parts = input.parts || [];
  const greenOnly = input.greenOnly === true;
  return {
    job: "grid",
    size: input.size,
    clearance: input.clearance,
    epsg: input.epsg,
    outer: input.outer,
    holes: input.holes || [],
    greenOnly,
    parts: parts.map(part => ({ type: part.type, geom: part.geom })),
    /* With the green-only filter off, the sampling domain is the whole park.
     * Do not pass OSM road, water, or hard-surface exclusions: those are
     * evidence layers, and must not punch gaps in full-park grid coverage. */
    blockRings: greenOnly
      ? (parts.length ? [] : [...(input.waterRings || []), ...(input.imperviousRings || [])])
      : [],
    blockLines: greenOnly ? [
      ...(input.waterLines || []).map(points => ({ pts: points, w: 1 })),
      ...(input.imperviousLines || []),
      ...(input.gridBlockLines || [])
    ] : []
  };
}

window.DG_GRID_REQUEST = Object.freeze({ build: dgBuildGridRequest });
