"use strict";

/* Preserve the registered area when OSM geometry has no measurable area. */
(function(root){
  function resolve(area,parkArea){return area>0?Math.round(area):parkArea;}
  root.DG_RESOLVE_PARK_GEOMETRY_BACKFILL_AREA=Object.freeze({resolve});
})(window);
