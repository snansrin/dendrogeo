/* Stable GeoJSON and CSV representations for park grid exports. */
(function(root){
 "use strict";
 function gridGeoJSON(cells){
  return{
   type:"FeatureCollection",
   features:cells.map(c=>({
    type:"Feature",
    properties:{
     id:c.id,
     olcum:c.n,
     alan_m2:c.areaM2||null,
     guvenlik_m:c.clearanceM||null,
     waypoint_lat:c.lat??null,waypoint_lon:c.lon??null,
     durum:c.n===0?"bos":"olculmus"
    },
    geometry:c.geometry||{
     type:"Polygon",
     coordinates:[[[c.w0,c.s0],[c.w1,c.s0],[c.w1,c.s1],[c.w0,c.s1],[c.w0,c.s0]]]
    }
   }))
  };
 }
 function waypointsCSV(rows){
  let csv="wp_id,lat,lon,visited\n";
  rows.forEach(r=>{csv+=r.wp_id+","+r.lat+","+r.lon+","+(r.visited?1:0)+"\n";});
  return csv;
 }
 root.DG_PARK_EXPORT_FORMATS=Object.freeze({gridGeoJSON,waypointsCSV});
})(window);
