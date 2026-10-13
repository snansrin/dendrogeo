"use strict";

/* Validate, project and clip a hand-drawn ring before it enters the campaign. */
window.DG_PREPARE_SURFACE_BOUNDARY={
  prepare({ring,epsg,parkGeometry,validRing,project,clip,area}){
    if(!validRing(ring))return{kind:"invalid-ring"};
    let geometry;try{geometry=clip("intersection",[project(ring,epsg)],parkGeometry);}catch(error){return{kind:"clip-error",error};}
    if(area(geometry)<.1)return{kind:"outside-or-small"};
    return{kind:"ready",geometry};
  }
};
