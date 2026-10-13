"use strict";

/* Use a whole-metre lower-left origin without changing relative geometry. */
window.DG_FIND_SURFACE_REVIEW_CLIP_ORIGIN={
  find(points){const bounds=points.reduce((box,point)=>[Math.min(box[0],point[0]),Math.min(box[1],point[1])],[Infinity,Infinity]);return[Math.floor(bounds[0]),Math.floor(bounds[1])];}
};
