"use strict";

/* Keep bounded, in-memory visitor metadata for the transient presence payload. */
(function(root){
 function create(){
  let views=[],lastAction=null,locations=[];
  function recordView(view){
   const last=views[views.length-1];
   if(last&&last.v===view)return false;
   views.push({v:view,t:Date.now()});
   if(views.length>8)views.shift();
   return true;
  }
  function recordAction(kind,detail){
   lastAction={k:kind,t:Date.now(),d:String(detail||"").slice(0,60)};
  }
  function recordLocation(latitude,longitude,at){
   const last=locations[locations.length-1];
   if(!last||Math.abs(last[0]-latitude)>1e-5||Math.abs(last[1]-longitude)>1e-5){
    locations.push([latitude,longitude,at]);
    if(locations.length>12)locations.shift();
   }
  }
  function snapshot(){return{views:views.slice(-8),lastAction,locations:locations.slice(-12)};}
  return Object.freeze({recordView,recordAction,recordLocation,snapshot});
 }
 root.DG_VISITOR_SESSION_EVENTS_APPLICATION=Object.freeze({create});
})(window);
