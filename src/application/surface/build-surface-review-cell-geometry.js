"use strict";

/* Project and clip a sampling cell to the prepared park geometry. */
window.DG_BUILD_SURFACE_REVIEW_CELL_GEOMETRY={
  build(cell,park,epsg,{project,clip}){return clip("intersection",[project(cell.quadWgs,epsg)],park);}
};
