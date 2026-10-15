"use strict";

/* Render GPS/header fields while leaving live target readout to the overlay. */
window.DG_RENDER_WAYPOINT_NAVIGATION_HEADER={
  render({model,getElement}){
    if(model.resetGuidance){
      getElement("navDist").textContent="—";
      getElement("navTarget").textContent=model.targetText;
      getElement("navArrow").style.transform="rotate(0)";
    }
    const gps=getElement("navGps");
    if(gps)gps.textContent=model.gpsText;
  },
  renderGuidance({target,gps,distance,translate,resolve,getElement}){
    const text=resolve({target,gps,distance,translate});
    getElement("navGuidance").textContent=text;
    return text;
  }
};
