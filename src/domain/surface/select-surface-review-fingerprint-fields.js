"use strict";

/* Keep fingerprint inputs limited to the established boundary, source and grid fields. */
window.DG_SELECT_SURFACE_REVIEW_FINGERPRINT_FIELDS={
  select(cells,outer,holes,meta){return{outer,holes,source:meta,grid:cells.map(cell=>[cell.row,cell.col,cell.epsg,cell.classKey,cell.areaM2,cell.quadWgs])};}
};
