"use strict";
(function(root){
 function build(rows,latin={}){
  return{type:"FeatureCollection",features:(rows||[]).map(row=>({
   type:"Feature",geometry:{type:"Point",coordinates:[row.lon,row.lat]},
   properties:{point:row.point_id,species:row.species,latin:latin[row.species]||"",
    dbh:Number.isFinite(+row.dbh_cm)?+(+row.dbh_cm).toFixed(1):null,height:row.height_m,
    carbon:row.carbon_kg,status:row.status,photo:row.photo_url||""}
  }))};
 }
 root.DG_ADMIN_MEASUREMENT_GEOJSON=Object.freeze({build});
})(window);
