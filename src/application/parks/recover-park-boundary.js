"use strict";
/* Recover actual park geometry independently of Overpass; never invent a bbox polygon. */
(function(root){
 const leisure=new Set(["park","garden","nature_reserve","common","recreation_ground"]);
 function relevant(element){return["way","relation"].includes(element?.type)&&leisure.has(element.tags?.leisure);}
 function create({findGeocoded,loadMap,extractRings,areaOf,containsPoint,cache,now=()=>Date.now()}){
  return async function recover(lat,lon,radius=1200){
   let geocodeError;try{const parks=await findGeocoded(lat,lon,radius);if(parks?.length)return parks;}catch(error){geocodeError=error;}
   const extent=Math.max(50,Math.min(2500,Number(radius)||1200)),dy=extent/111320,dx=dy/Math.max(.1,Math.cos(lat*Math.PI/180));
   let response;try{response=await loadMap([lat-dy,lon-dx,lat+dy,lon+dx].join(","));}catch(error){throw geocodeError||error;}
   if(!response?.complete||!Array.isArray(response.elements)){if(geocodeError)throw geocodeError;return[];}
   const parks=[];
   for(const element of response.elements){
    if(!relevant(element))continue;
    const rings=extractRings(element);if(!rings||!containsPoint(lat,lon,rings))continue;
    const area=areaOf(rings);if(!(area>0))continue;
    const park={rings,area,name:element.tags?.name||null,type:element.type,id:Number(element.id),boundaryProvider:"osm-api"};
    if(!Number.isSafeInteger(park.id)||park.id<=0)continue;
    cache?.set(park.type+"/"+park.id,{park,time:now()});parks.push(park);
   }
   return parks.sort((a,b)=>a.area-b.area);
  };
 }
 root.DG_RECOVER_PARK_BOUNDARY=Object.freeze({create,relevant});
})(window);
