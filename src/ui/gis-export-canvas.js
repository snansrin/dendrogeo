/* Canvas rendering helpers for GIS PNG exports. */
(function(root){
 "use strict";
 const drawLegend=root.DG_GIS_EXPORT_CANVAS_LEGEND.drawLegend;
 const {drawRawPatches}=root.DG_GIS_EXPORT_CANVAS_PATCHES;
 const {eachRing,drawLeaflet}=root.DG_GIS_EXPORT_CANVAS_LEAFLET;
 const {drawGrid,drawVerifiedGrid}=root.DG_GIS_EXPORT_CANVAS_GRIDS;
 const {drawWaypoints,drawVerifiedWaypoints}=root.DG_GIS_EXPORT_CANVAS_WAYPOINTS;
 root.DG_GIS_EXPORT_CANVAS=Object.freeze({eachRing,drawLeaflet,drawRawPatches,drawGrid,drawWaypoints,drawVerifiedGrid,drawVerifiedWaypoints,drawLegend});
})(window);
