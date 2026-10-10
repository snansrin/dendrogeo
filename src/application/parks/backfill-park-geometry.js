"use strict";
/* Backfill a stored park boundary from its canonical OSM identity. */
(function(root){
  function create({isAdmin,getPark,fetchRing,calculateArea,saveGeometry,notify,onComplete}){
    return async function backfillParkGeometry(parkId){
      if(!isAdmin())return{status:"forbidden"};
      const park=await getPark(parkId);
      if(!park)return{status:"park-not-found"};
      notify("loading",park);
      let geometry;
      try{geometry=await fetchRing(park.osm_key);}
      catch(error){notify("osm-error",park,error);return{status:"osm-error",error,park};}
      if(!geometry){notify("boundary-not-found",park);return{status:"boundary-not-found",park};}
      const area=calculateArea(geometry,park);
      const result=await saveGeometry(parkId,{geom_json:geometry,area_m2:area>0?Math.round(area):park.area_m2});
      if(result&&result.error){notify("write-error",park,result.error);return{status:"write-error",error:result.error,park};}
      notify("saved",park);
      onComplete(park);
      return{status:"saved",park,geometry,areaM2:area>0?Math.round(area):park.area_m2};
    };
  }
  root.DG_PARK_GEOMETRY_BACKFILL_APPLICATION=Object.freeze({create});
})(window);
