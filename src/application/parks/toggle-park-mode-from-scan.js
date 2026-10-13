"use strict";

/* Keep the scan-card refresh paired with the existing park-mode toggle. */
window.DG_TOGGLE_PARK_MODE_FROM_SCAN={
  toggle(ports){ports.toggle();ports.renderCard();}
};
