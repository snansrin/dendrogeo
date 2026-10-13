"use strict";
/* Pure park/geolocation decision. The service supplies locked thresholds and geometry ports. */
(function(root){
  function decide(fix,park,options,{config,distanceToPark,hav,pointInPark}){
    const cfg=Object.assign({},config,options||{});
    if(!park)return{ok:true,verified:false,inside:false,reason:"no-park",distM:null,acc:fix&&fix.acc};
    if(!fix||!Number.isFinite(+fix.lat)||!Number.isFinite(+fix.lon))
      return{ok:false,verified:false,inside:false,reason:"no-fix",distM:null,acc:null};
    const acc=Number.isFinite(+fix.acc)?+fix.acc:null;
    if(acc!=null&&acc>cfg.ACC_MAX_M)
      return{ok:false,verified:false,inside:false,reason:"acc",distM:null,acc};
    const geometry=park.geom_json&&Array.isArray(park.geom_json.outer)?park.geom_json:null;
    const distM=park.centroid_lat!=null?Math.round(hav(+fix.lat,+fix.lon,+park.centroid_lat,+park.centroid_lon)):null;
    if(!geometry){
      if(distM==null)return{ok:true,verified:false,inside:false,reason:"no-geom",distM:null,acc};
      const radius=Math.max(150,Math.sqrt((+park.area_m2||0)/Math.PI)*1.25);
      return distM<=radius
        ?{ok:true,verified:false,inside:false,reason:"circle",distM,acc}
        :{ok:false,verified:false,inside:false,reason:"outside",distM,acc};
    }
    const inside=pointInPark(+fix.lat,+fix.lon,geometry);
    const edge=inside?0:(distanceToPark(+fix.lat,+fix.lon,geometry)||Infinity);
    if(inside)return{ok:true,verified:true,inside:true,reason:"inside",distM,acc};
    if(edge<=cfg.MARGIN_M)return{ok:true,verified:true,inside:false,reason:"margin",distM,acc,edgeM:Math.round(edge)};
    return{ok:false,verified:false,inside:false,reason:"outside",distM,acc,edgeM:Math.round(edge)};
  }
  root.DG_PARK_GEOFENCE_DECISION=Object.freeze({decide});
})(window);
