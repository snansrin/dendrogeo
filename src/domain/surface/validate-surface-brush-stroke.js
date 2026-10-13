"use strict";

/* Accept only finite WGS84 points, supported classes, and known brush sizes. */
window.DG_VALIDATE_SURFACE_BRUSH_STROKE={
  valid({points,type,diameter,types,allowed}){
    return !!points?.length&&points.length<=300&&points.every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=90&&Math.abs(point[1])<=180)&&!!types[type]&&allowed.includes(diameter);
  }
};
