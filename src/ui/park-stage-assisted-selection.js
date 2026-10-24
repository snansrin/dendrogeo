"use strict";
/* Four references define independent cut lines; active park/analysis stay unchanged. */
(function(root){
 function create(ports){
  let map=null,captureTarget=null,cuts=[[],[]],active=0,markers=[[],[]],previewLayer=null,lineLayer=null,parentLayer=null,proposalLayer=null,locked=false,previousMode=false,previousGuard=false,previousZoom=false,epoch=0;
  function removePreview(){for(const layer of [previewLayer,lineLayer])if(layer&&map)map.removeLayer(layer);previewLayer=null;lineLayer=null;}
  function clear(){
   ++epoch;removePreview();if(!map)return;
   captureTarget?.removeEventListener("click",capture,true);captureTarget=null;ports.document.removeEventListener("keydown",key);
   for(const marker of markers.flat())map.removeLayer(marker);markers=[[],[]];if(parentLayer)map.removeLayer(parentLayer);parentLayer=null;if(proposalLayer)map.removeLayer(proposalLayer);proposalLayer=null;
   if(previousZoom)map.doubleClickZoom.enable();ports.setMode(previousMode);ports.setGuard(previousGuard);map=null;cuts=[[],[]];active=0;locked=false;
  }
  function key(event){if(event.key==="Escape"&&!locked){clear();ports.status("Bölüm seçimi iptal edildi.");ports.onCancel();}}
  function drawPreview(result){
   if(!map)return;removePreview();
   const rings=[...result.geometry.outer,...(result.geometry.inner||[])];
   previewLayer=ports.leaflet.polygon(rings,{color:"#e9a23b",weight:3,fillColor:"#e9a23b",fillOpacity:.22,interactive:false}).addTo(map);
   if(result.lines?.length)lineLayer=ports.leaflet.layerGroup(result.lines.map(line=>ports.leaflet.polyline(line,{color:"#f97316",weight:3,dashArray:"7 5",interactive:false}))).addTo(map);
  }
  async function update(){
   ports.onProgress?.({counts:cuts.map(line=>line.length),active});
   if(!cuts.every(line=>line.length===2)){removePreview();lineLayer=ports.leaflet.layerGroup(cuts.filter(line=>line.length===2).map(line=>ports.leaflet.polyline(line,{color:"#f97316",weight:3,dashArray:"7 5",interactive:false}))).addTo(map);ports.status((active?"Bitiş":"Başlangıç")+" sınırı için köprü boyunca iki referans seçin.");return;}
   const token=++epoch,snapshot=cuts.map(line=>line.map(p=>[...p]));ports.status("İki sınır arasındaki park alanı hazırlanıyor…");
   try{const result=await ports.between(snapshot);if(token!==epoch||!map)return;drawPreview(result);ports.onPreview(result);}
   catch(error){if(token===epoch){removePreview();ports.onInvalid();ports.status(error.message);}}
  }
  function add(point){
   if(locked||cuts[active].length===2)return;const boundary=active,index=cuts[boundary].length;cuts[boundary].push(point);
   const icon=ports.leaflet.divIcon?.({className:"dg-stage-reference",html:"<span>"+(boundary*2+index+1)+"</span>",iconSize:[44,44],iconAnchor:[22,22]});
   const marker=ports.leaflet.marker(point,{...(icon?{icon}:{}),draggable:true,keyboard:true,title:(boundary?"Bitiş":"Başlangıç")+" · referans "+(index+1),alt:(boundary?"Bitiş":"Başlangıç")+" referans "+(index+1)}).addTo(map);
   marker.on("dragstart",()=>{++epoch;removePreview();ports.onInvalid();});
   marker.on("dragend",()=>{const p=marker.getLatLng();cuts[boundary][index]=[p.lat,p.lng];void update();});markers[boundary].push(marker);
   if(cuts[0].length===2&&cuts[1].length===0)active=1;
   void update();
  }
  function capture(event){
   if(!map||locked||cuts[active].length===2||event.target?.closest?.(".leaflet-control,.leaflet-marker-icon,.dg-stage-cut-panel")||map.dragging?.moved?.()||map.boxZoom?.moved?.())return;
   event.preventDefault();event.stopImmediatePropagation();const p=map.mouseEventToLatLng(event);add([p.lat,p.lng]);
  }
  function prepare(){
   clear();map=ports.getMap();if(!map)throw Error("Harita hazır değil.");previousMode=ports.getMode();previousGuard=ports.getGuard();previousZoom=map.doubleClickZoom.enabled();
   ports.setMode(false);ports.setGuard(true);map.doubleClickZoom.disable();
   const parent=ports.parentGeometry();parentLayer=ports.leaflet.polygon([...parent.outer,...(parent.inner||[])],{color:"#94a3b8",weight:2,fillOpacity:0,interactive:false}).addTo(map);
   map.fitBounds(parentLayer.getBounds(),{padding:[24,24],paddingTopLeft:ports.padding?.()||[24,24]});ports.document.addEventListener("keydown",key);
  }
  return Object.freeze({start(){prepare();captureTarget=map.getContainer();captureTarget.addEventListener("click",capture,true);void update();},selectBoundary(index){if(!map||locked||![0,1].includes(index))return;++epoch;active=index;removePreview();ports.onInvalid();for(const marker of markers[index])map.removeLayer(marker);markers[index]=[];cuts[index]=[];void update();},show(result){if(!map)prepare();if(proposalLayer){map.removeLayer(proposalLayer);proposalLayer=null;}drawPreview(result);},showProposals(results,select){prepare();proposalLayer=ports.leaflet.layerGroup(results.map((result,index)=>ports.leaflet.polygon([...result.geometry.outer,...result.geometry.inner],{color:"#e9a23b",weight:2,fillOpacity:.10}).on("click",()=>{if(!locked)select(index);}).bindTooltip(result.label))).addTo(map);},clear,setLocked(value){locked=value;for(const marker of markers.flat())if(value)marker.dragging.disable();else marker.dragging.enable();},isActive:()=>!!map});
 }
 root.DG_PARK_STAGE_ASSISTED_UI=Object.freeze({create});
})(window);
