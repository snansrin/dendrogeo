"use strict";
/* Resolve a legacy project's park through the existing staged search order. */
(function(root){
  function create({queryNear,queryByName,sleep}){
    return async function detectBackfillPark(lat,lon,projectName){
      let candidates=await queryNear(lat,lon,1500);
      if(candidates&&candidates.length)return{cands:candidates,yol:"1500 m"};
      await sleep(2100);
      candidates=await queryNear(lat,lon,3500);
      if(candidates&&candidates.length)return{cands:candidates,yol:"3500 m"};
      await sleep(2100);
      candidates=await queryByName(lat,lon,projectName);
      if(candidates&&candidates.length)return{cands:candidates,yol:"ad araması"};
      return{cands:null,yol:"bulunamadı"};
    };
  }
  root.DG_BACKFILL_PARK_DETECTION_APPLICATION=Object.freeze({create});
})(window);
