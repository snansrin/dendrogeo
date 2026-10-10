"use strict";
/* Clear park presentation and local state in the legacy order. */
(function(root){
 function create({clearMenus,getMap,layers,resetGeometry,resetIdentity,cleanupReview,resetSurface}){
  return function clearParkController(){
   clearMenus();
   for(const entry of layers){
    const layer=entry.get();const map=layer?getMap():null;
    if(layer&&map){map.removeLayer(layer);entry.clear();}
   }
   resetGeometry();resetIdentity();
   try{cleanupReview();}catch(error){}
   resetSurface();
  };
 }
 root.DG_PARK_RESET_CONTROLLER_UI=Object.freeze({create});
})(window);
