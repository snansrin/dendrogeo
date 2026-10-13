"use strict";

/* Keep the cheap bounds gate before exact polygon intersections. */
window.DG_SURFACE_GEOMETRY_OVERLAP={
  bounds(a,geometry,geometryBounds,overlap){
    if(!geometry?.length)return false;
    const b=geometryBounds(geometry);return overlap(a,b);
  }
};
