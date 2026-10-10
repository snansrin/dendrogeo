"use strict";

/* Assemble the existing grid-worker request from resolved park and surface inputs. */
function dgBuildGridRequest(input) {
  const parts = input.parts || [];
  return {
    job: "grid",
    size: input.size,
    clearance: input.clearance,
    epsg: input.epsg,
    outer: input.outer,
    holes: input.holes || [],
    greenOnly: input.greenOnly,
    parts: parts.map(part => ({ type: part.type, geom: part.geom })),
    blockRings: parts.length ? [] : [...(input.waterRings || []), ...(input.imperviousRings || [])],
    blockLines: [
      ...(input.waterLines || []).map(points => ({ pts: points, w: 1 })),
      ...(input.imperviousLines || []),
      ...(input.gridBlockLines || [])
    ]
  };
}

window.DG_GRID_REQUEST = Object.freeze({ build: dgBuildGridRequest });
