"use strict";

/* Create Leaflet display polygons and attach the existing editor click route. */
window.DG_RENDER_SURFACE_DISPLAY_POLYGONS={
  render({features,state,leaflet,colors,onClick}){
    state.displayPaths=[];
    for(const feature of features){
      const type=feature.properties.class,rings=feature.geometry.coordinates.map(polygon=>polygon.map(ring=>ring.map(point=>[point[1],point[0]])));
      const polygon=leaflet.polygon(rings,{renderer:state.renderer,stroke:false,weight:0,smoothFactor:1,bubblingMouseEvents:false,fillColor:colors[type]||colors.other});
      polygon.on("click",event=>onClick(event,state.epoch,state.geometry));state.displayPaths.push({poly:polygon,cls:type});
    }
    return state.displayPaths;
  }
};
