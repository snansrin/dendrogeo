"use strict";
/* Overpass name search and geometry conversion for legacy park backfill. */
(function(root){
  function create({normalizeName,request,extractRings,polyArea}){
    return async function searchOsmParkByName(lat,lon,projectName){
      const words=normalizeName(projectName).split(" ").filter(word=>word.length>2);
      if(!words.length||typeof request!=="function")return null;
      const expression=words.join("|").replace(/["\\]/g,"");
      if(!expression)return null;
      const leisure="park|garden|nature_reserve|common|recreation_ground";
      const query=
        `[out:json][timeout:35];(`+
        `way["leisure"~"${leisure}"]["name"~"${expression}",i](around:5000,${lat},${lon});`+
        `relation["leisure"~"${leisure}"]["name"~"${expression}",i](around:5000,${lat},${lon});`+
        `way["landuse"~"recreation_ground|meadow|grass"]["name"~"${expression}",i](around:5000,${lat},${lon});`+
        `);out geom;`;
      let json;
      try{json=await request(query,"park adıyla");}catch(error){return null;}
      if(!json||!Array.isArray(json.elements)||!json.elements.length)return null;
      const candidates=[];
      for(const element of json.elements){
        if(typeof extractRings!=="function")break;
        const rings=extractRings(element);
        if(!rings)continue;
        const area=typeof polyArea==="function"?polyArea(rings):null;
        candidates.push({rings,name:element.tags&&element.tags.name||null,area,type:element.type,id:element.id});
      }
      if(!candidates.length)return null;
      candidates.sort((a,b)=>(b.area||0)-(a.area||0));
      return candidates;
    };
  }
  root.DG_OSM_PARK_NAME_SEARCH_ADAPTER=Object.freeze({create});
})(window);
