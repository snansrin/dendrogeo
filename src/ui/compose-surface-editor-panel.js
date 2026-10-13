"use strict";

/* Compose the independently rendered editor sections in their stable DOM order. */
window.DG_COMPOSE_SURFACE_EDITOR_PANEL={
  render({scanPanel,sensitivityControls,reviewActions}){return scanPanel+sensitivityControls+reviewActions;}
};
