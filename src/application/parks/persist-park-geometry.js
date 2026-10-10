"use strict";
/* Save the current park boundary when available; a failure keeps circle fallback. */
(function(root){
  function create({getGeometry,maxPoints,simplifyRing,updateGeometry,warn}){
    return async function persistParkGeometry(park){
      try{
        const source=getGeometry();
        const outer=source&&Array.isArray(source.outer)&&source.outer.length>=3?source.outer:null;
        if(!park||!park.id||!outer)return park;
        const holes=source&&Array.isArray(source.inner)?source.inner:[];
        const geom={
          outer:[simplifyRing(outer,maxPoints)],
          inner:holes.map(ring=>simplifyRing(ring,maxPoints)).filter(ring=>ring&&ring.length>=3)
        };
        const{data,error}=await updateGeometry(park.id,geom);
        if(error){warn("write-error",error);return park;}
        return data||park;
      }catch(error){warn("exception",error);return park;}
    };
  }
  root.DG_PARK_GEOMETRY_APPLICATION=Object.freeze({create});
})(window);
