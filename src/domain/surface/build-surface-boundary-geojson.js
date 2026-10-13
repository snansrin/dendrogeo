"use strict";
/* Export only valid reviewed boundaries clipped to the selected park. */
(function(root){
  function build({record,rawView,parkGeometry,epsg,validFeature,featureGeometry,clip,area,unproject,warn}){
    const features=[];if(rawView||!record||!parkGeometry||!epsg)return{type:"FeatureCollection",features};
    for(const boundary of record.features||[]){
      if(!validFeature(boundary))continue;
      try{
        const clipped=clip("intersection",featureGeometry(boundary,epsg),parkGeometry);
        if(!clipped.length||area(clipped)<=.01)continue;
        features.push({type:"Feature",properties:{class:boundary.type,source:boundary.source||boundary.method||"manual",osmId:boundary.osmId||null},geometry:{type:"MultiPolygon",coordinates:unproject(clipped,epsg)}});
      }catch(error){if(typeof warn==="function")warn("DENDROGEO · kabul edilmiş sınır çizilemedi:",String(error?.message||error));}
    }
    return{type:"FeatureCollection",features};
  }
  root.DG_BUILD_SURFACE_BOUNDARY_GEOJSON=Object.freeze({build});
})(window);
