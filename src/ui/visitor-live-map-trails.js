"use strict";

/* Render transient location trails without putting them in persistent storage. */
window.DG_VISITOR_LIVE_MAP_TRAILS_UI={
  render({leaflet,layer,row,color,trails,buildTrail,hasLocation}){
    if(!trails||!Array.isArray(row.p.lh)||row.p.lh.length<2)return;
    try{
      const trail=buildTrail(row.p.lh,hasLocation);
      if(trail.points.length>1)leaflet.polyline(trail.points,{color,weight:2,opacity:.55,dashArray:"3 6",interactive:false}).addTo(layer);
      if(trail.start)leaflet.circleMarker(trail.start,{radius:3,color,fillColor:"#fff",fillOpacity:.9,weight:2,interactive:false}).addTo(layer);
    }catch(_){/* A malformed optional trail must not hide the current location. */}
  }
};
