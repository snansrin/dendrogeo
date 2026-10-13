"use strict";
/* Convert classified OSM elements into water, surface, and grid-block geometry. */
(function(root){
  function collect(classified,{extractRings,isClosedLine,addWaterRing,addWaterLine,collectPedestrianGridBlocker,collectImperviousGeometry}){
    for(const item of classified){
      const {element}=item;
      if(item.skip)continue;
      if(item.water){
        if(element.type==="relation"){
          const rings=extractRings(element);
          if(Array.isArray(rings))rings.forEach(ring=>{if(ring&&ring.length>=3)addWaterRing(ring);});
          else if(rings&&rings.outer)rings.outer.forEach(ring=>{if(ring&&ring.length>=3)addWaterRing(ring);});
          continue;
        }
        if(!element.geometry)continue;
        const points=element.geometry.map(point=>[point.lat,point.lon]);
        if(isClosedLine(points))addWaterRing(points);
        else if(points.length>1)addWaterLine(points);
        continue;
      }
      if(item.pedestrian)collectPedestrianGridBlocker(element);
      if(item.impervious)collectImperviousGeometry(element);
    }
  }
  root.DG_COLLECT_PARK_COVERAGE_ELEMENTS=Object.freeze({collect});
})(window);
