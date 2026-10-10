"use strict";
/* Validate manual park input, convert hectares, and delegate identity storage. */
(function(root){
  function create({getName,getAreaHectares,getLocation,registerPark}){
    return async function createManualPark(){
      const name=String(getName()||"").trim();
      if(!name)return{status:"name-required"};
      const point=getLocation();
      if(!point||!Number.isFinite(+point.lat))return{status:"location-required"};
      const hectares=Number.parseFloat(String(getAreaHectares()||"").replace(",","."));
      const candidate={name,source:"manual",area:Number.isFinite(hectares)&&hectares>0?hectares*10000:null};
      const row=await registerPark(candidate,{manual:true,lat:+point.lat,lon:+point.lon});
      if(!row)return{status:"registration-failed"};
      return{status:"created",row};
    };
  }
  root.DG_PARK_MANUAL_CREATION_APPLICATION=Object.freeze({create});
})(window);
