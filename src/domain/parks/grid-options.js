"use strict";

/* Resolve the existing grid size default and bounded clearance setting. */
function dgResolveGridOptions(sizeInput, clearanceInput) {
  const size = Number(sizeInput) || 20;
  const clearance = Math.max(1, Math.min(20, Number(clearanceInput) || 3));
  return { size, clearance };
}

window.DG_GRID_OPTIONS = Object.freeze({ resolve: dgResolveGridOptions });
