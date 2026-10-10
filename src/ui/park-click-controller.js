"use strict";
/* Bind one map listener; surface review retains ownership of its clicks. */
(function(root){
 function create({isBound,setBound,getMap,getMode,isReviewActive,detect,logError,notify}){
  return function bindParkClickController(){
   if(isBound())return;
   const map=getMap();if(!map)return;
   setBound(true);
   map.on("click",async event=>{
    if(!getMode())return;
    if(isReviewActive())return;
    try{await detect(event.latlng.lat,event.latlng.lng);}
    catch(error){
     logError("DENDROGEO · Park tıklama hatası:",error);
     notify("Park analizi başarısız: "+(error?.message||String(error)),"err","🌳");
    }
   });
  };
 }
 root.DG_PARK_CLICK_CONTROLLER_UI=Object.freeze({create});
})(window);
