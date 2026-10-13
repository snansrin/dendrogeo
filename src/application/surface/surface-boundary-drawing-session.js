"use strict";

/* Coordinate start, point entry, undo and cancellation for the map drawing session. */
window.DG_SURFACE_BOUNDARY_DRAWING_SESSION={
  start(ports){
    const{rawView,busy,saving,draw,openMenu,cancelObject,stopBrush,map,selectedType,currentType,setDraw,setStatus,translate,updateStatus,guard,drawPoint,renderTools}=ports;
    if(rawView||busy||saving)return;
    if(draw){openMenu();return;}
    cancelObject();stopBrush();map.invalidateSize({pan:false});const type=selectedType||currentType||"building";
    setDraw({type,ring:[]});setStatus(translate("Haritada sınır köşelerine dokunun; tamamlamak için ✓ düğmesine basın."));updateStatus();guard(true);map.on("click",drawPoint);renderTools();openMenu();
  },
  addPoint({draw,event,insidePark,setStatus,translate,updateStatus,render,renderTools}){
    if(!draw||!event?.latlng)return;
    const{lat,lng}=event.latlng;if(!insidePark(lat,lng)){setStatus(translate("Köşe park sınırının dışında; çizim park içine kırpılır."));updateStatus();return;}
    if(draw.ring.length>=300)return;draw.ring.push([lng,lat]);render();renderTools();
  },
  back({draw,render,renderTools}){if(draw){draw.ring.pop();render();renderTools();}},
  cancel({map,layer,setLayer,setDraw,drawPoint}){if(layer)map.removeLayer(layer);setLayer(null);setDraw(null);map.off("click",drawPoint);}
};
