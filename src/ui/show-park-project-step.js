"use strict";

/* Open the scan card's project step and preserve its smooth scroll behavior. */
window.DG_SHOW_PARK_PROJECT_STEP={
  show(ports){
    ports.setScanActive(true);ports.renderCard();
    const card=ports.element("parkScanCard");
    if(card&&card.scrollIntoView)card.scrollIntoView({behavior:"smooth",block:"start"});
  }
};
