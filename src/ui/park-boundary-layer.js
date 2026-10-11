"use strict";
/* Draw the selected boundary and fit it without changing its coordinates. */
(function(root){
 function renderParkBoundaryLayer({leaflet:L,map,outer,holes,onCreated}){
  const layer=L.layerGroup().addTo(map);onCreated(layer);

  L.polygon(
    outer,
    {
      color:"#2b6cb0",
      weight:2.5,
      dashArray:"6,6",
      fillColor:"#3b82f6",
      fillOpacity:.10,
      interactive:false
    }
  ).addTo(layer);

  holes.forEach(r=>{
    L.polygon(
      r,
      {
        color:"#2b6cb0",
        weight:1.5,
        fillColor:"#ffffff",
        fillOpacity:.85,
        interactive:false
      }
    ).addTo(layer);
  });

  return layer;
 }
 function fitParkBoundaryLayer({leaflet:L,map,outer,holes}){
  const parkBounds = L.latLngBounds(outer);

  if(holes && holes.length){
    holes.forEach(ring=>{
      ring.forEach(p=>{
        parkBounds.extend(p);
      });
    });
  }

  if(parkBounds.isValid()){
    map.fitBounds(
      parkBounds,
      {
        padding:[30,30]
      }
    );
  }

 }
 root.DG_PARK_BOUNDARY_LAYER_UI=Object.freeze({render:renderParkBoundaryLayer,fit:fitParkBoundaryLayer});
})(window);
