"use strict";

/* Project stored review feature geometry into the active analysis CRS. */
window.DG_PROJECT_SURFACE_REVIEW_FEATURE_GEOMETRY={
  project(feature,epsg,{projectRing,isValidRing}){
    if(feature.geometry?.type==="MultiPolygon")return feature.geometry.coordinates.map(polygon=>polygon.map(ring=>projectRing(ring,epsg)));
    return isValidRing(feature.ring)?[[projectRing(feature.ring,epsg)]]:[];
  }
};
