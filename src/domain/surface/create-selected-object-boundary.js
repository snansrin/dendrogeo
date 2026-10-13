"use strict";

/* Preserve the saved visual-boundary record shape and provenance. */
window.DG_SELECTED_OBJECT_BOUNDARY={
  create({type,geometry,osmId,timestamp=new Date().toISOString()}){
    return{type,geometry,method:"visual-boundary",source:"osm-selected",osmId,ts:timestamp};
  }
};
