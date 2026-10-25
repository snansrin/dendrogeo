"use strict";
/* Independent quick cuts or detailed cap paths; active park/analysis stay unchanged. */
(function(root){
 function create(ports){
  let map=null,captureTarget=null,cuts=[[],[]],active=0,selected=-1,markers=[[],[]],previewLayer=null,lineLayer=null,parentLayer=null,proposalLayer=null,editLayer=null,locked=false,detailed=false,finished=[false,false],previousMode=false,previousGuard=false,previousZoom=false,epoch=0,referenceEpoch=0;
  function removePreview(){for(const layer of [previewLayer,lineLayer])if(layer&&map)map.removeLayer(layer);previewLayer=null;lineLayer=null;}
  function clear(){
   ++epoch;++referenceEpoch;removePreview();if(!map)return;
   captureTarget?.removeEventListener("click",capture,true);captureTarget=null;ports.document.removeEventListener("keydown",key);
   for(const marker of markers.flat())map.removeLayer(marker);markers=[[],[]];if(parentLayer)map.removeLayer(parentLayer);parentLayer=null;if(proposalLayer)map.removeLayer(proposalLayer);proposalLayer=null;if(editLayer)map.removeLayer(editLayer);editLayer=null;
   if(previousZoom)map.doubleClickZoom.enable();ports.setMode(previousMode);ports.setGuard(previousGuard);map=null;cuts=[[],[]];active=0;selected=-1;locked=false;detailed=false;finished=[false,false];
  }
  function key(event){if(event.key==="Escape"&&!locked){clear();ports.status("Bölüm seçimi iptal edildi.");ports.onCancel();}}
  function drawPreview(result){
   if(!map)return;removePreview();
   const rings=[...result.geometry.outer,...(result.geometry.inner||[])];
   previewLayer=ports.leaflet.polygon(rings,{color:"#e9a23b",weight:3,fillColor:"#e9a23b",fillOpacity:.22,interactive:false}).addTo(map);
   if(result.lines?.length)lineLayer=ports.leaflet.layerGroup(result.lines.map(line=>ports.leaflet.polyline(line,{color:"#f97316",weight:3,dashArray:"7 5",interactive:false}))).addTo(map);
  }
  async function update(){
   progress();
   if(!cuts.every(line=>line.length>=2)){removePreview();lineLayer=ports.leaflet.layerGroup(cuts.filter(line=>line.length>=2).map(line=>ports.leaflet.polyline(line,{color:"#f97316",weight:3,dashArray:"7 5",interactive:false}))).addTo(map);const missing=cuts.findIndex(line=>line.length<2);ports.status((missing?"Bitiş":"Başlangıç")+(detailed?" hattına en az iki nokta koyun. Hat düğmeleriyle diğer sınıra geçebilirsiniz.":" sınırı için köprü boyunca iki referans seçin."));return;}
   const token=++epoch,snapshot=cuts.map(line=>line.map(p=>[...p]));ports.status("İki sınır arasındaki park alanı hazırlanıyor…");
   try{const result=await ports.between(snapshot,{detailed});if(token!==epoch||!map)return;drawPreview(result);ports.onPreview(result);}
   catch(error){if(token===epoch){removePreview();ports.onInvalid();ports.status(error.message);}}
  }
  function progress(){ports.onProgress?.({counts:cuts.map(line=>line.length),active,selected,detailed,finished:[...finished]});}
  function selectPoint(index,boundary=active){if(!map||locked||!cuts[boundary]?.[index])return;active=boundary;selected=index;references();progress();}
  function references(){
   const version=++referenceEpoch,current=()=>version===referenceEpoch&&map&&!locked;
   for(const marker of markers.flat())map.removeLayer(marker);markers=[[],[]];if(editLayer)map.removeLayer(editLayer);editLayer=null;
   cuts.forEach((line,boundary)=>line.forEach((point,index)=>{
   const icon=ports.leaflet.divIcon?.({className:"dg-stage-reference"+(active===boundary&&selected===index?" is-selected":""),html:"<span>"+(detailed?(boundary+1)+"."+(index+1):boundary*2+index+1)+"</span>",iconSize:[44,44],iconAnchor:[22,22]});
   const marker=ports.leaflet.marker(point,{...(icon?{icon}:{}),draggable:true,keyboard:true,title:(boundary?"Bitiş":"Başlangıç")+" · referans "+(index+1),alt:(boundary?"Bitiş":"Başlangıç")+" referans "+(index+1)}).addTo(map);
   marker.on("click",()=>{if(current())selectPoint(index,boundary);});
   marker.on("dragstart",()=>{if(!current())return;active=boundary;selected=index;++epoch;removePreview();ports.onInvalid();progress();});
   marker.on("dragend",()=>{if(!current())return;const p=marker.getLatLng();cuts[boundary][index]=[p.lat,p.lng];references();void update();});markers[boundary].push(marker);
   }));
   if(detailed)editLayer=ports.leaflet.layerGroup(cuts.flatMap((line,boundary)=>line.slice(1).map((point,index)=>ports.leaflet.polyline([line[index],point],{color:"#e9a23b",weight:8,opacity:.45,className:"dg-stage-cut-segment"}).on("click",event=>{if(!current())return;active=boundary;add([event.latlng.lat,event.latlng.lng],index+1);})))) .addTo(map);
  }
  function add(point,index=cuts[active].length){
   if(!map||locked||(!detailed&&cuts[active].length===2))return;
   if(cuts[active].length>=40){ports.status("Her hatta en fazla 40 nokta kullanılabilir.");return;}
   ++epoch;removePreview();ports.onInvalid();cuts[active].splice(index,0,point);selected=index;
   if(!detailed){finished[active]=cuts[active].length===2;if(finished[0]&&!cuts[1].length)active=1;}
   references();void update();
  }
  function capture(event){
   if(!map||locked||(!detailed&&cuts[active].length===2)||event.target?.closest?.(".leaflet-control,.leaflet-marker-icon,.dg-stage-cut-panel,.dg-stage-cut-segment")||map.dragging?.moved?.()||map.boxZoom?.moved?.())return;
   event.preventDefault();event.stopImmediatePropagation();const p=map.mouseEventToLatLng(event);add([p.lat,p.lng]);
  }
  function prepare(){
   clear();map=ports.getMap();if(!map)throw Error("Harita hazır değil.");previousMode=ports.getMode();previousGuard=ports.getGuard();previousZoom=map.doubleClickZoom.enabled();
   ports.setMode(false);ports.setGuard(true);map.doubleClickZoom.disable();
   const parent=ports.parentGeometry();parentLayer=ports.leaflet.polygon([...parent.outer,...(parent.inner||[])],{color:"#94a3b8",weight:2,fillOpacity:0,interactive:false}).addTo(map);
   map.fitBounds(parentLayer.getBounds(),{animate:false,padding:[24,24],paddingTopLeft:ports.padding?.()||[24,24]});ports.document.addEventListener("keydown",key);
  }
  return Object.freeze({start(initial=null,detail=false){prepare();detailed=detail;if(initial){cuts=initial.map(line=>line.map(p=>[...p]));finished=[true,true];references();}captureTarget=map.getContainer();captureTarget.addEventListener("click",capture,true);void update();},selectPoint,deletePoint(){if(!map||locked||selected<0||!cuts[active][selected])return;++epoch;cuts[active].splice(selected,1);selected=-1;ports.onInvalid();references();void update();},finishBoundary(){if(!map||locked||!detailed)return;if(cuts[active].length<2){ports.status("Hattı tamamlamak için en az iki nokta seçin.");return;}finished[active]=true;if(!finished[1-active])active=1-active;void update();},undo(){if(!map||locked||!detailed)return;++epoch;finished[active]=false;cuts[active].pop();selected=-1;ports.onInvalid();references();void update();},resetBoundary(){if(!map||locked)return;++epoch;cuts[active]=[];selected=-1;finished[active]=false;ports.onInvalid();references();void update();},selectBoundary(index){if(!map||locked||![0,1].includes(index))return;++epoch;active=index;selected=-1;removePreview();ports.onInvalid();finished[index]=false;if(!detailed)cuts[index]=[];references();void update();},show(result){if(!map)prepare();if(proposalLayer){map.removeLayer(proposalLayer);proposalLayer=null;}drawPreview(result);},showProposals(results,select){prepare();proposalLayer=ports.leaflet.layerGroup(results.map((result,index)=>ports.leaflet.polygon([...result.geometry.outer,...result.geometry.inner],{color:"#e9a23b",weight:2,fillOpacity:.10}).on("click",()=>{if(!locked)select(index);}).bindTooltip(result.label))).addTo(map);},clear,setLocked(value){locked=value;for(const marker of markers.flat())if(value)marker.dragging.disable();else marker.dragging.enable();},isActive:()=>!!map});
 }
 root.DG_PARK_STAGE_ASSISTED_UI=Object.freeze({create});
})(window);
