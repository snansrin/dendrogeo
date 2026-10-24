"use strict";
/* Two clicks define cut planes; preview never changes the active park/analysis. */
(function(root){
 function create(ports){
  let map=null,captureTarget=null,points=[],markers=[],previewLayer=null,lineLayer=null,parentLayer=null,previousMode=false,previousGuard=false,previousZoom=false,epoch=0;
  function removePreview(){for(const layer of [previewLayer,lineLayer])if(layer&&map)map.removeLayer(layer);previewLayer=null;lineLayer=null;}
  function clear(){
   ++epoch;removePreview();if(!map)return;
   captureTarget?.removeEventListener("click",capture,true);captureTarget=null;ports.document.removeEventListener("keydown",key);
   for(const marker of markers)map.removeLayer(marker);markers=[];if(parentLayer)map.removeLayer(parentLayer);parentLayer=null;
   if(previousZoom)map.doubleClickZoom.enable();ports.setMode(previousMode);ports.setGuard(previousGuard);map=null;points=[];
  }
  function key(event){if(event.key==="Escape"){clear();ports.status("Bölüm seçimi iptal edildi.");ports.onCancel();}}
  function drawPreview(result){
   if(!map)return;removePreview();
   const rings=[...result.geometry.outer,...(result.geometry.inner||[])];
   previewLayer=ports.leaflet.polygon(rings,{color:"#e9a23b",weight:3,fillColor:"#e9a23b",fillOpacity:.22,interactive:false}).addTo(map);
   if(result.lines?.length)lineLayer=ports.leaflet.layerGroup(result.lines.map(line=>ports.leaflet.polyline(line,{color:"#f97316",weight:3,dashArray:"7 5",interactive:false}))).addTo(map);
  }
  async function update(){
   if(points.length!==2)return;
   const token=++epoch,snapshot=points.map(p=>[...p]);ports.status("İki sınır arasındaki park alanı hazırlanıyor…");
   try{const result=await ports.between(snapshot);if(token!==epoch||!map)return;drawPreview(result);ports.onPreview(result);}
   catch(error){if(token===epoch){removePreview();ports.onInvalid();ports.status(error.message);}}
  }
  function add(point){
   if(points.length===2)return;const index=points.length;points.push(point);
   const marker=ports.leaflet.marker(point,{draggable:true,keyboard:true,title:index?"Bitiş sınırı":"Başlangıç sınırı"}).addTo(map);
   marker.on("dragstart",()=>{++epoch;removePreview();ports.onInvalid();});
   marker.on("dragend",()=>{const p=marker.getLatLng();points[index]=[p.lat,p.lng];void update();});markers.push(marker);
   if(points.length===1)ports.status("Başlangıç seçildi. Şimdi etabın bittiği yere dokunun.");else void update();
  }
  function capture(event){
   if(!map||points.length===2||event.target?.closest?.(".leaflet-control,.leaflet-marker-icon")||map.dragging?.moved?.()||map.boxZoom?.moved?.())return;
   event.preventDefault();event.stopImmediatePropagation();const p=map.mouseEventToLatLng(event);add([p.lat,p.lng]);
  }
  function prepare(){
   clear();map=ports.getMap();if(!map)throw Error("Harita hazır değil.");previousMode=ports.getMode();previousGuard=ports.getGuard();previousZoom=map.doubleClickZoom.enabled();
   ports.setMode(false);ports.setGuard(true);map.doubleClickZoom.disable();
   const parent=ports.parentGeometry();parentLayer=ports.leaflet.polygon([...parent.outer,...(parent.inner||[])],{color:"#94a3b8",weight:2,fillOpacity:0,interactive:false}).addTo(map);
   map.fitBounds(parentLayer.getBounds(),{padding:[24,24]});ports.document.addEventListener("keydown",key);
  }
  return Object.freeze({start(){prepare();captureTarget=map.getContainer();captureTarget.addEventListener("click",capture,true);ports.status("Etabın başladığı yere, ardından bittiği yere dokunun. Çevre çizmenize gerek yok.");},show(result){if(!map)prepare();drawPreview(result);},clear,setLocked(value){for(const marker of markers)if(value)marker.dragging.disable();else marker.dragging.enable();},isActive:()=>!!map});
 }
 root.DG_PARK_STAGE_ASSISTED_UI=Object.freeze({create});
})(window);
