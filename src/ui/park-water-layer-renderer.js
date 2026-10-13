"use strict";
/* Rebuild the non-interactive water overlay from the accepted park geometry. */
(function(root){
  function refresh({layer,map,leaflet,rings,lines,satelliteMode,setLayer}){
    if(layer&&map)map.removeLayer(layer);
    const next=leaflet.layerGroup().addTo(map);
    setLayer(next);
    rings.forEach(ring=>{
      if(!ring||ring.length<3)return;
      leaflet.polygon(ring,{color:"#2563eb",weight:1,dashArray:null,fillColor:"#60a5fa",fillOpacity:.42,interactive:false}).addTo(next);
    });
    lines.forEach(line=>{
      if(!line||line.length<2)return;
      leaflet.polyline(line,{color:"#2563eb",weight:2,opacity:.55,dashArray:satelliteMode?"6 4":null,interactive:false}).addTo(next);
    });
  }
  root.DG_PARK_WATER_LAYER_RENDERER=Object.freeze({refresh});
})(window);
