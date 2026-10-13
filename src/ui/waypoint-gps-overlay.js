"use strict";
/* Draw GPS position, bearing arrow and straight-line guidance on the nav map. */
(function(root){
  function draw({map,waypoints,target,gps,leaflet,distance,bearing,getElement,translate,setTarget}){
    if(root.DG_RENDER_WAYPOINT_GPS_OVERLAY&&root.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER&&root.DG_RESOLVE_WAYPOINT_GPS_GUIDANCE&&root.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT&&root.DG_ADD_WAYPOINT_GUIDANCE_LINE)return root.DG_RENDER_WAYPOINT_GPS_OVERLAY.render({map,waypoints,target,gps,leaflet,distance,bearing,getElement,translate,setTarget,createLocationMarker:root.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER,renderReadout:root.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT,addGuidanceLine:root.DG_ADD_WAYPOINT_GUIDANCE_LINE});
    const arrowBearing=target&&!target.visited?bearing(gps.latitude,gps.longitude,target.lat,target.lon):null;
    const marker=leaflet.marker([gps.latitude,gps.longitude],{
      icon:leaflet.divIcon({
        className:"",
        html:`<div class="loc-marker">${arrowBearing!=null?`<svg class="nav-arrow-svg" viewBox="0 0 100 100" style="transform:rotate(${arrowBearing}deg)"><path d="M50 5 L70 70 L50 55 L30 70 Z" fill="#2b6cb0" stroke="#fff" stroke-width="4"/></svg>`:""}<div class="dot"></div></div>`,
        iconSize:[48,48],iconAnchor:[24,24]
      }),zIndexOffset:1000
    }).addTo(map);marker._wp=1;
    if(!target){
      const pending=waypoints.filter(point=>!point.visited);
      if(pending.length){
        target=pending.sort((a,b)=>distance(gps.latitude,gps.longitude,a.lat,a.lon)-distance(gps.latitude,gps.longitude,b.lat,b.lon))[0];
        setTarget(target);
      }
    }
    if(target&&!target.visited){
      const meters=distance(gps.latitude,gps.longitude,target.lat,target.lon);
      const targetBearing=bearing(gps.latitude,gps.longitude,target.lat,target.lon);
      getElement("navDist").textContent=Math.round(meters)+" m";
      getElement("navTarget").textContent=translate("Hedef:")+" P"+target.wp_id+" · "+Math.round(targetBearing)+"°";
      getElement("navArrow").style.transform="rotate("+targetBearing+"deg)";
      const line=leaflet.polyline([[gps.latitude,gps.longitude],[target.lat,target.lon]],{color:"#c2452d",dashArray:"5,8",weight:2}).addTo(map);line._wp=1;
    }else{
      getElement("navDist").textContent="—";
      getElement("navTarget").textContent=translate("Hedef seç / tamamlandı");
      getElement("navArrow").style.transform="rotate(0)";
    }
    return target;
  }
  root.DG_WAYPOINT_GPS_OVERLAY=Object.freeze({draw});
})(window);
