"use strict";
/* Temporary Leaflet drawing, fully removed before the active scope changes. */
(function(root){
 function create(ports){
  let map=null,layer=null,parentLayer=null,captureTarget=null,points=[],previousMode=false,previousDoubleClick=false,previousGuard=false;
  function status(){ports.status(points.length+" köşe seçildi. En az 3 köşe ile sınırı kabul edebilirsiniz.");}
  function redraw(){if(!map)return;if(layer)map.removeLayer(layer);layer=ports.leaflet.polyline(points,{color:"#e9a23b",weight:3,dashArray:"6 5",interactive:false}).addTo(map);status();}
  function click(event){if(points.length<300&&event?.latlng){points.push([event.latlng.lat,event.latlng.lng]);redraw();}}
  function capture(event){
   if(!map||event.target?.closest?.(".leaflet-control")||map.dragging?.moved?.()||map.boxZoom?.moved?.())return;
   event.preventDefault();event.stopImmediatePropagation();click({latlng:map.mouseEventToLatLng(event)});
  }
  function key(event){if(event.key==="Escape"){cancel();ports.status("Etap çizimi iptal edildi.");}}
  function cancel(){
   if(!map)return;map.off("click",click);if(layer)map.removeLayer(layer);if(parentLayer)map.removeLayer(parentLayer);
   captureTarget?.removeEventListener("click",capture,true);captureTarget=null;
   if(previousDoubleClick)map.doubleClickZoom.enable();ports.setMode(previousMode);ports.setGuard(previousGuard);
   ports.document.removeEventListener("keydown",key);map=null;layer=null;parentLayer=null;points=[];
  }
  function start(){
   cancel();map=ports.getMap();if(!map)throw Error("Harita henüz hazır değil.");
   previousMode=ports.getMode();previousGuard=ports.getGuard();previousDoubleClick=map.doubleClickZoom.enabled();
   ports.setMode(false);ports.setGuard(true);map.doubleClickZoom.disable();map.on("click",click);ports.document.addEventListener("keydown",key);status();
   captureTarget=map.getContainer?.();captureTarget?.addEventListener("click",capture,true);
   const parent=ports.parentGeometry?.();if(parent?.outer?.length){parentLayer=ports.leaflet.polygon([...parent.outer,...(parent.inner||[])],{color:"#e9a23b",weight:2,fillOpacity:0,dashArray:"4 6",interactive:false}).addTo(map);map.fitBounds(parentLayer.getBounds(),{padding:[20,20]});}
  }
  return Object.freeze({start,cancel,undo(){points.pop();redraw();},ring(){return points.length?[...points.map(p=>[...p]),[...points[0]]]:[];}});
 }
 root.DG_PARK_STAGE_DRAWING_UI=Object.freeze({create});
})(window);
