"use strict";
(function(root){
 function build(rows,latin,{preview=false}={}){
  return{type:"FeatureCollection",features:rows.map(row=>({type:"Feature",geometry:{type:"Point",coordinates:[row.lon,row.lat]},properties:preview?
   {point:row.point_id,species:row.species,carbon:row.carbon_kg}:
   {point:row.point_id,species:row.species,latin:latin[row.species]||"",circumference_cm:(Number.isFinite(+row.girth_cm)?+row.girth_cm:null),dbh:(Number.isFinite(+row.dbh_cm)?+(+row.dbh_cm).toFixed(1):null),height:row.height_m,carbon:row.carbon_kg,photo:row.photo_url||""}}))};
 }
 root.DG_BUILD_MEASUREMENT_GEOJSON=Object.freeze({build});
})(window);
