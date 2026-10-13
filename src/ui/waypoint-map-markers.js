"use strict";
/* Clear and redraw waypoint pins, retaining click selection and popup labels. */
(function(root){
  function draw({map,waypoints,leaflet,translate,onSelect}){
    map.eachLayer(layer=>{if(layer._wp)map.removeLayer(layer);});
    waypoints.forEach(point=>{
      const done=point.visited;
      const icon=leaflet.divIcon({
        className:"",
        html:`<div class="wp-badge2 ${done?"done":""}" style="--wpbg:${done?"#16a34a":"#e11d48"}"><span>${point.wp_id}</span></div>`,
        iconSize:[28,28],iconAnchor:[14,24]
      });
      const marker=leaflet.marker([point.lat,point.lon],{icon}).addTo(map);marker._wp=1;
      marker.bindPopup(done?"<s>P"+point.wp_id+"</s> "+translate("✓ Yapıldı"):"P"+point.wp_id+" · "+translate("Hedef yapmak için tıkla"));
      marker.on("click",()=>onSelect(point.id));
    });
  }
  root.DG_WAYPOINT_MAP_MARKERS=Object.freeze({draw});
})(window);
