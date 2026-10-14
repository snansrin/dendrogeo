"use strict";
/* Optimistic rendering reads canonical cell geometry; it does not edit raster cells. */
window.DG_SURFACE_CELL_PREVIEW_LAYER={render(entries,{state,map,leaflet,cellKey,unproject,colors}){
 if(!state.showCand||!state.geometry||!leaflet||!map)return;
 for(const entry of entries||[]){if(!entry?.cell)continue;const key=cellKey(entry.cell);if(state.geometry[key]?.length)state.optimisticPaths.set(key,entry.type);}
 if(!state.optimisticPaths.size)return;
 if(!state.optimisticLayer)state.optimisticLayer=leaflet.layerGroup().addTo(map);
 state.optimisticLayer.clearLayers();const groups=new Map();
 for(const[key,type]of state.optimisticPaths){const geometry=state.geometry[key];if(!geometry?.length)continue;let group=groups.get(type);if(!group)groups.set(type,group=[]);
  const coordinates=unproject(geometry,state.epsg);for(const polygon of coordinates)group.push(polygon.map(ring=>ring.map(point=>[point[1],point[0]])));
 }
 for(const[type,polygons]of groups){const layer=leaflet.polygon(polygons,{renderer:state.renderer||undefined,stroke:false,weight:0,fillColor:colors[type]||colors.other,fillOpacity:state.opacity/100,interactive:false,smoothFactor:0});layer.addTo(state.optimisticLayer);}
}};
