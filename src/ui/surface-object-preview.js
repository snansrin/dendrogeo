"use strict";

/* Own the Leaflet preview layer for a selected OSM boundary. */
window.DG_SURFACE_OBJECT_PREVIEW={
  render({map,leaflet,result,colors}){
    return leaflet.geoJSON({type:"Feature",properties:{},geometry:result.geometry},{style:{color:colors[result.type]||"#2d8150",weight:3,dashArray:"7 5",fillOpacity:.16,interactive:false}}).addTo(map);
  },
  remove({map,layer}){if(layer&&map)map.removeLayer(layer);}
};
