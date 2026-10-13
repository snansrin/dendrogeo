"use strict";

/* Adapt [longitude, latitude] rings to the projected metric review geometry. */
window.DG_PROJECT_SURFACE_REVIEW_RING={
  project(ring,epsg,{forward,snap}){return ring.map(point=>{const projected=forward(point[1],point[0],epsg);return snap(projected.x,projected.y);});}
};
