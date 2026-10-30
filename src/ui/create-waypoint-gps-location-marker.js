"use strict";

/* Only the blue GPS location symbol follows the device heading.
 * Never rotate or move the red waypoint markers, guidance line or map. */
(function(root){
  let marker=null;
  const valid=value=>typeof value==="number"&&Number.isFinite(value);
  function setHeading(heading){
    const arrow=marker?.getElement?.()?.querySelector?.(".nav-arrow-svg");
    if(!arrow)return;
    if(!valid(heading)){arrow.style.visibility="hidden";return;}
    arrow.style.transform="rotate("+((heading%360+360)%360)+"deg)";
    arrow.style.visibility="visible";
  }
  root.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER=Object.freeze({
    add({map,gps,leaflet}){
      const icon=leaflet.divIcon({className:"",html:
        '<div class="loc-marker"><svg class="nav-arrow-svg" viewBox="0 0 100 100" style="transform:rotate(0deg);visibility:hidden;transition:transform .12s linear">'+
        '<path d="M50 50 L16 11 Q50 -1 84 11 Z" fill="#2b6cb0" fill-opacity=".16"/>'+
        '<path d="M50 5 L70 70 L50 55 L30 70 Z" fill="#2b6cb0" stroke="#fff" stroke-width="4"/>'+
        '</svg><div class="dot"></div></div>',iconSize:[48,48],iconAnchor:[24,24]});
      marker=leaflet.marker([gps.latitude,gps.longitude],{icon,zIndexOffset:1000}).addTo(map);
      marker._wp=1;
      return marker;
    },
    setHeading
  });
})(window);
