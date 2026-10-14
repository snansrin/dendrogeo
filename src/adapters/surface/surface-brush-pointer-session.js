"use strict";

/* Own Leaflet pointer capture, temporary stroke preview, and map interaction locks. */
window.DG_SURFACE_BRUSH_POINTER_SESSION={
  stop({state,map}){
    const brush=state.brush;if(!brush)return;state.brush=null;
    for(const [event,handler] of brush.handlers)brush.container.removeEventListener(event,handler,true);
    try{if(brush.stroke)brush.container.releasePointerCapture(brush.stroke.pointerId);}catch(error){}
    if(brush.preview)map.removeLayer(brush.preview);
    brush.container.classList.remove('dg-paint-brush-active');brush.container.style.touchAction=brush.touchAction;brush.container.style.cursor=brush.cursor;
    if(brush.dragging)map.dragging.enable();if(brush.zoom)map.doubleClickZoom.enable();
  },
  start({state,map,leaflet,container,type,diameter,colors,forward,onCommit,onError,render}){
    container.classList.add('dg-paint-brush-active');
    const brush=state.brush={container,type,diameter,epoch:state.epoch,record:state.record,dragging:map.dragging.enabled(),zoom:map.doubleClickZoom.enabled(),touchAction:container.style.touchAction,cursor:container.style.cursor,handlers:[]};
    map.dragging.disable();map.doubleClickZoom.disable();container.style.touchAction='none';container.style.cursor='crosshair';
    const point=event=>{const value=map.mouseEventToLatLng(event);return[value.lat,value.lng];},stopEvent=event=>{event.preventDefault();event.stopImmediatePropagation();};
    const add=event=>{
      const next=point(event),last=brush.stroke.points.at(-1),projected=forward(next[0],next[1],state.epsg);
      if(last){const previous=forward(last[0],last[1],state.epsg);if(Math.hypot(projected.x-previous.x,projected.y-previous.y)<brush.diameter/6)return;}
      if(brush.stroke.points.length<300)brush.stroke.points.push(next);
      if(!brush.preview)brush.preview=leaflet.layerGroup().addTo(map);
      if(brush.stroke.points.length>1){
        if(!brush.previewLine)brush.previewLine=leaflet.polyline(brush.stroke.points,{color:colors[brush.type],weight:4,interactive:false}).addTo(brush.preview);
        else brush.previewLine.setLatLngs(brush.stroke.points);
      }
      if(!brush.previewCircle)brush.previewCircle=leaflet.circle(next,{radius:brush.diameter/2,color:colors[brush.type],fillOpacity:.2,interactive:false}).addTo(brush.preview);
      else brush.previewCircle.setLatLng(next);
    };
    const down=event=>{if(event.target?.closest?.('.leaflet-control')||event.button!==0||!event.isPrimary||state.busy||state.saving||brush.stroke)return;stopEvent(event);brush.stroke={pointerId:event.pointerId,points:[]};container.setPointerCapture(event.pointerId);add(event);};
    const move=event=>{if(brush.stroke?.pointerId!==event.pointerId)return;stopEvent(event);add(event);};
    const finish=event=>{if(brush.stroke?.pointerId!==event.pointerId)return;stopEvent(event);if(event.type==='pointerup')add(event);const points=brush.stroke.points;brush.stroke=null;if(brush.preview)map.removeLayer(brush.preview);brush.preview=null;brush.previewLine=null;brush.previewCircle=null;try{container.releasePointerCapture(event.pointerId);}catch(error){}
      if(event.type==='pointerup'&&brush.epoch===state.epoch&&brush.record===state.record)onCommit(points,brush.type,brush.diameter).catch(onError);
    };
    for(const [event,handler] of [['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',finish],['lostpointercapture',finish]]){container.addEventListener(event,handler,true);brush.handlers.push([event,handler]);}
    render();return brush;
  }
};
