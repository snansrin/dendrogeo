"use strict";
/* Apply explicit OSM water polygons while keeping raw raster evidence intact. */
(function(root){
  function refine(result,waterRings,pointInRing){if(!waterRings||!waterRings.length)return 0;let changed=0;for(const cell of(result.cells||[])){if(cell.classKey==="water")continue;const lat=cell.center.lat,lon=cell.center.lon;let inside=false;for(const ring of waterRings){if(pointInRing(lat,lon,ring)){inside=true;break;}}if(!inside)continue;const area=cell.areaM2||0,old=cell.classKey;if(old){result.groupCounts[old]=Math.max(0,(result.groupCounts[old]||1)-1);result.groupAreas[old]=Math.max(0,(result.groupAreas[old]||area)-area);}else{result.maskedCount=Math.max(0,(result.maskedCount||1)-1);result.maskedAreaM2=Math.max(0,(result.maskedAreaM2||area)-area);result.classifiedAreaM2=(result.classifiedAreaM2||0)+area;}result.groupCounts.water=(result.groupCounts.water||0)+1;result.groupAreas.water=(result.groupAreas.water||0)+area;cell.classKey="water";cell.classCode=80;cell.waterRefined=true;changed++;}return changed;}
  root.DG_REFINE_WATER_BY_OSM=Object.freeze({refine});
})(window);
