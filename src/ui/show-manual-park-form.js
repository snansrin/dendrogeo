"use strict";

/* Show the inline manual form or open the scan card's manual entry section. */
window.DG_SHOW_MANUAL_PARK_FORM={
  show(ports){
    const box=ports.element("manualParkBox");
    if(box&&box.style){box.style.display="block";return;}
    ports.setPending(ports.resolvePoint());
    ports.renderCard(true);
  }
};
