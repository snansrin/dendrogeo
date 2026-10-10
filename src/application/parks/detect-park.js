"use strict";
/* Orchestrate one coordinate-based park lookup, including stale request safety. */
(function(root){
  function create({isOnline,queryPark,setAnchor,setCandidates,offerManual,drawPark,notify,warn}){
    let requestSequence=0;
    return async function detect(lat,lon,opt){
      opt=opt||{};
      if(!Number.isFinite(+lat)||!Number.isFinite(+lon))return notify("invalid-location");
      if(!isOnline()&&!opt.silent)return notify("offline");
      if(!opt.silent)notify("searching");
      setAnchor({lat:+lat,lon:+lon});

      const request=++requestSequence;
      let parks=null;
      try{parks=await queryPark(+lat,+lon,opt.radius||1200);}
      catch(error){
        warn(error);
        if(request===requestSequence&&!opt.silent)notify("query-failed",error);
        return null;
      }
      if(request!==requestSequence)return null;
      if(!parks||!parks.length){
        if(opt.silent)return null;
        offerManual(+lat,+lon);
        return null;
      }
      setCandidates(parks);
      if(opt.silent)return parks;
      await drawPark(parks[0]);
      return parks;
    };
  }
  root.DG_PARK_DETECTION_APPLICATION=Object.freeze({create});
})(window);
