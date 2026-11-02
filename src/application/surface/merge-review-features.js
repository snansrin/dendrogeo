"use strict";
/* Group accepted review parts into stable GeoJSON features for display/export. */
(function(root){
 function create({union,unproject}){
  function mergeGeometries(geometries){
   // Bound function arguments for large parks without dropping any review part.
   let level=geometries;
   while(level.length>128){
    const next=[];
    for(let i=0;i<level.length;i+=128)next.push(union(level.slice(i,i+128)));
    level=next;
   }
   return union(level);
  }
  function merge(parts,epsg){
   const groups={};
   for(const part of parts){
    const group=groups[part.type]||(groups[part.type]={geoms:[],area:0,methods:new Set()});
    group.geoms.push(part.geom);group.area+=part.areaM2;group.methods.add(part.method);
   }
   return Object.entries(groups).map(([type,group])=>({
    type:"Feature",
    properties:{class:type,area_m2:group.area,method:[...group.methods].sort().join("+")},
    geometry:{type:"MultiPolygon",coordinates:unproject(mergeGeometries(group.geoms),epsg)}
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
