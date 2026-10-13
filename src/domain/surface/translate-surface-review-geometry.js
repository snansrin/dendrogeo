"use strict";

/* Translate every ring vertex by one shared metric offset. */
window.DG_TRANSLATE_SURFACE_REVIEW_GEOMETRY={
  translate(geometry,dx,dy){return geometry.map(polygon=>polygon.map(ring=>ring.map(point=>[point[0]+dx,point[1]+dy])));}
};
