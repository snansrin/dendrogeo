"use strict";

/* Render only the temporary hand-drawn boundary layer. */
window.DG_SURFACE_BOUNDARY_DRAWING_PREVIEW={
  render({map,leaflet,draw,colors,previousLayer}){
    if(previousLayer)map.removeLayer(previousLayer);
    const layer=leaflet.layerGroup().addTo(map),points=draw.ring.map(point=>[point[1],point[0]]),color=colors[draw.type];
    if(points.length>1)leaflet.polyline(points,{color,dashArray:"5 5",interactive:false}).addTo(layer);
    if(points.length>2)leaflet.polyline([points.at(-1),points[0]],{color,dashArray:"2 6",opacity:.7,interactive:false}).addTo(layer);
    for(const point of points)leaflet.circleMarker(point,{radius:5,color,fillColor:"#fff",fillOpacity:1,weight:2,interactive:false}).addTo(layer);
    return layer;
  },
  clear({map,layer}){if(layer)map.removeLayer(layer);}
};
