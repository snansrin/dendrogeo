"use strict";

/* Own the Leaflet presentation for transient visitor locations. */
window.DG_VISITOR_LIVE_MAP_UI={
 create(){
  function initialize({element,map,layer,leaflet,attribution}){
   if(!element||map||!leaflet)return{map,layer};
   try{
    map=leaflet.map("visMap").setView([39,35],6);
    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution,maxZoom:19}).addTo(map);
    layer=leaflet.layerGroup().addTo(map);
   }catch(e){map=null;layer=null;}
   return{map,layer};
  }
  function draw({map,layer,leaflet,rows,hasLocation,viewLabels,translate,escape,colorFor,trails,follow,fit,buildTrail}){
   if(!map||!layer)return fit;
   try{map.invalidateSize();}catch(e){}
   layer.clearLayers();
   const located=[];
   for(const row of (rows||[])){
    if(!hasLocation(row.p))continue;
    located.push(row);
    const color=colorFor(row.p.id)||"#2b6cb0";
    const presentation=window.DG_VISITOR_MAP_MARKER_UI.build(row,{color,viewLabels,translate,escape});
    const icon=leaflet.divIcon(presentation.icon);
    if(trails&&Array.isArray(row.p.lh)&&row.p.lh.length>1){
     try{
      const trail=buildTrail(row.p.lh,hasLocation);
      if(trail.points.length>1)leaflet.polyline(trail.points,{color,weight:2,opacity:.55,dashArray:"3 6",interactive:false}).addTo(layer);
      if(trail.start)leaflet.circleMarker(trail.start,{radius:3,color,fillColor:"#fff",fillOpacity:.9,weight:2,interactive:false}).addTo(layer);
     }catch(e){}
    }
    leaflet.marker([row.p.la,row.p.lo],{icon,interactive:true,keyboard:false,zIndexOffset:700}).addTo(layer)
     .bindTooltip(presentation.tooltip,presentation.tooltipOptions);
   }
   try{
    if((!fit||follow)&&located.length===1)map.setView([located[0].p.la,located[0].p.lo],13);
    else if((!fit||follow)&&located.length>1)map.fitBounds(leaflet.latLngBounds(located.map(row=>[row.p.la,row.p.lo])).pad(0.35),{maxZoom:14});
    if(located.length)fit=true;
   }catch(e){}
   return fit;
  }
  return Object.freeze({initialize,draw});
 }
};
