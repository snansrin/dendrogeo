"use strict";

/* Keep only valid coordinates from a transient visitor location trail. */
window.DG_BUILD_LIVE_LOCATION_TRAIL={
 build(history,hasLocation){
  if(!Array.isArray(history))return{points:[],start:null};
  const points=history.filter(point=>Array.isArray(point)&&hasLocation({la:point[0],lo:point[1]}))
   .slice(-30).map(point=>[point[0],point[1]]);
  return{points,start:points[0]||null};
 }
};
