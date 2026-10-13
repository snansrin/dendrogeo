"use strict";
(function(root){
 function focus(latitude,longitude,ports){
  try{
   if(!ports.allowed()||!ports.hasLocation({la:latitude,lo:longitude}))return;
   const toggle=ports.followControl();if(toggle)toggle.checked=false;
   const map=ports.map();if(map)map.setView([latitude,longitude],16);
  }catch(error){}
 }
 root.DG_FOCUS_LIVE_VISITOR_LOCATION=Object.freeze({focus});
})(window);
