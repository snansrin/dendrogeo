"use strict";
/* Query candidate park polygons and preserve the legacy boundary fallback. */
(function(root){
  function create({queryOsm,boundaryFallback,extractRings,areaOf,containsPoint}){
    return async function findParkCandidates(lat,lon,radius=1200){
      const query=
        `[out:json][timeout:35];(`+
        `way["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
        `relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
        `);`+
        `out geom;`;

      const parkData=await queryOsm(query);
      if(!parkData||!Array.isArray(parkData.elements)||parkData.remark){
        const fallback=await boundaryFallback(lat,lon,radius);
        if(fallback.length)return fallback;
        throw new Error("OSM park sınırı alınamadı. Bağlantı hatası parkın bulunmadığı anlamına gelmez; yeniden deneyin.");
      }
      if(!parkData.elements.length)return [];

      const candidates=[];
      for(const element of parkData.elements){
        const rings=extractRings(element);
        if(!rings)continue;
        const hasGeometry=Array.isArray(rings)
          ?rings.length>0
          :!!(rings.outer&&rings.outer.length>0);
        if(!hasGeometry)continue;
        candidates.push({
          rings,
          name:(element.tags&&element.tags.name)||null,
          area:areaOf(rings),
          type:element.type,
          id:element.id
        });
      }
      if(!candidates.length)throw new Error("OSM park geometrisi eksik; yeniden deneyin.");

      const valid=candidates.filter(candidate=>Array.isArray(candidate.rings)
        ?candidate.rings.some(ring=>Array.isArray(ring)&&ring.length>=4)
        :!!(candidate.rings&&Array.isArray(candidate.rings.outer)&&candidate.rings.outer.some(ring=>Array.isArray(ring)&&ring.length>=4)));
      if(!valid.length)throw new Error("OSM park geometrisi geçersiz; yeniden deneyin.");

      const inside=valid.filter(candidate=>containsPoint(lat,lon,candidate.rings));
      return(inside.length?inside:valid).slice().sort((a,b)=>a.area-b.area);
    };
  }
  root.DG_PARK_CANDIDATE_SEARCH_APPLICATION=Object.freeze({create});
})(window);
