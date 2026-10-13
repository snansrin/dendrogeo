"use strict";

/* Route a displayed polygon click to object pick, drawing, or cell review. */
window.DG_HANDLE_SURFACE_DISPLAY_LAYER_CLICK={
  handle({event,state,leaflet,epoch,geometry,isCurrent,onObjectPick,drawPoint,forward,parts,bounds,pointDistance,popup}){
    const original=event.originalEvent||event;if(original&&leaflet.DomEvent?.stopPropagation)leaflet.DomEvent.stopPropagation(original);
    if(!isCurrent(epoch,geometry))return;
    if(state.objectPick){onObjectPick(event);return;}
    if(state.brush)return;
    if(state.draw){drawPoint(event);return;}
    const point=forward(event.latlng.lat,event.latlng.lng,state.epsg);
    const part=parts().find(item=>{const box=item.displayBounds||(item.displayBounds=bounds(item.geom));return point.x>=box[0]&&point.x<=box[2]&&point.y>=box[1]&&point.y<=box[3]&&pointDistance([point.x,point.y],item.geom)>=0;});
    if(part)popup(part.key);
  }
};
