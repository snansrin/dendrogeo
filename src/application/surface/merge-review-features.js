"use strict";
/* Group accepted review parts into stable GeoJSON features for display/export. */
(function(root){
 function create({union,unproject}){
  function merge(parts,epsg){
   const groups={};
   for(const part of parts){
    const group=groups[part.type]||(groups[part.type]={geoms:[],area:0,methods:new Set()});
    group.geoms.push(part.geom);group.area+=part.areaM2;group.methods.add(part.method);
   }
   return Object.entries(groups).map(([type,group])=>({
    type:"Feature",
    properties:{class:type,area_m2:group.area,method:[...group.methods].sort().join("+")},
    geometry:{type:"MultiPolygon",coordinates:unproject(union(group.geoms),epsg)}
   }));
  }
  function display(parts,epsg,park,prepared=null){
   // Display the original analytical geometry without smoothing or another overlay.
   return prepared||merge(parts,epsg);
  }
  return Object.freeze({merge,display});
 }
 root.DG_SURFACE_REVIEW_FEATURES=Object.freeze({create});
})(window);
