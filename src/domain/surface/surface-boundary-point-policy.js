"use strict";

/* Preserve the established permissive fallback when the park point gate is unavailable. */
window.DG_SURFACE_BOUNDARY_POINT_POLICY={
  isInside({lat,lon,pointInPark,parkPolygon}){try{return typeof pointInPark==="function"?pointInPark(lat,lon,parkPolygon):true;}catch(e){return true;}}
};
