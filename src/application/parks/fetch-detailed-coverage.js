"use strict";

/* Loads one complete OSM coverage response for the currently selected park.
 * Geometry classification and cache mutation remain in the service layer. */
window.DG_PARK_COVERAGE_FETCH_APPLICATION = {
  create({getParkPolygon, queryOsm, queryFallback, preferFallback=()=>false}) {
    const completed=new Map(),valid=data=>Array.isArray(data?.elements)&&!data.remark;
    return async function fetchDetailedCoverage() {
      const parkPolygon = getParkPolygon();
      if (!parkPolygon || !parkPolygon.length) return null;

      const boundary = JSON.stringify(parkPolygon);
      let minLat = 90;
      let maxLat = -90;
      let minLon = 180;
      let maxLon = -180;

      parkPolygon.forEach(ring => ring.forEach(point => {
        if (point[0] < minLat) minLat = point[0];
        if (point[0] > maxLat) maxLat = point[0];
        if (point[1] < minLon) minLon = point[1];
        if (point[1] > maxLon) maxLon = point[1];
      }));

      const pad = 0.0005;
      const bbox = `${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;
      const previous=completed.get(boundary),policy=window.DG_OSM_SURFACE_QUERY;
      let json=previous&&Date.now()-previous.time<600000?previous.json:null;
      let triedFallback=false;
      if(!json&&queryFallback&&preferFallback()){triedFallback=true;try{json=await queryFallback(bbox);}catch(error){}}
      if(!valid(json))try{json=await queryOsm(policy.build(bbox),"yüzey+su");}catch(error){}
      if(!valid(json)&&queryFallback&&!triedFallback)try{json=await queryFallback(bbox);}catch(error){}
      if(!valid(json)){
        json=null;const elements=new Map();
        for(const group of policy.groups){
          if(boundary!==JSON.stringify(getParkPolygon()))break;
          let part=null;try{part=await queryOsm(policy.build(bbox,group),"yüzey+su");}catch(error){}
          if(!valid(part)){elements.clear();break;}
          for(const element of part.elements)elements.set(element.type+"/"+element.id,element);
          if(group===policy.groups.at(-1))json={elements:[...elements.values()],complete:true};
        }
      }
      if (boundary !== JSON.stringify(getParkPolygon())) {
        return {stale: true, boundary, bbox: {minLat, minLon, maxLat, maxLon}, pad, json: null};
      }
      if(valid(json)){if(completed.size>=8&&!completed.has(boundary))completed.delete(completed.keys().next().value);completed.set(boundary,{time:Date.now(),json});}
      return {stale: false, boundary, bbox: {minLat, minLon, maxLat, maxLon}, pad, json};
    };
  }
};
