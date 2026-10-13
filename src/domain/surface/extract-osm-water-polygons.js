"use strict";
/* Convert Overpass way and relation outer members to legacy [lat,lon] rings. */
(function(root){
  function extract(data,isWaterElement){const rings=[];for(const element of(data&&data.elements)||[]){if(!isWaterElement(element))continue;if(element.type==="way"&&element.geometry&&element.geometry.length>=3)rings.push(element.geometry.map(point=>[point.lat,point.lon]));else if(element.type==="relation"&&element.members){const outer=element.members.filter(member=>member.role==="outer"||member.role===""),ring=[];for(const member of outer)for(const point of(member.geometry||[]))ring.push([point.lat,point.lon]);if(ring.length>=3)rings.push(ring);}}return rings;}
  root.DG_EXTRACT_OSM_WATER_POLYGONS=Object.freeze({extract});
})(window);
