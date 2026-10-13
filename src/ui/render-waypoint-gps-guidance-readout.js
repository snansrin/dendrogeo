"use strict";

window.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT={
  render({target,meters,targetBearing,getElement,translate}){
    if(target&&!target.visited){
      getElement("navDist").textContent=Math.round(meters)+" m";
      getElement("navTarget").textContent=translate("Hedef:")+" P"+target.wp_id+" · "+Math.round(targetBearing)+"°";
      getElement("navArrow").style.transform="rotate("+targetBearing+"deg)";
      return;
    }
    getElement("navDist").textContent="—";
    getElement("navTarget").textContent=translate("Hedef seç / tamamlandı");
    getElement("navArrow").style.transform="rotate(0)";
  }
};
