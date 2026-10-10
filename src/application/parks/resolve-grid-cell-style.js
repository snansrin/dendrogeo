"use strict";

/* Keep the grid's selected, empty, and measured cell styles consistent. */
function dgResolveGridCellStyle(cell, selected = false) {
  if (selected) {
    return { color: "#1d4ed8", weight: 3, fillColor: "#3b82f6", fillOpacity: 0.55 };
  }
  const color = cell.n === 0 ? "#e11d48" : "#16a34a";
  return { color, weight: 1.2, fillColor: color, fillOpacity: 0.32 };
}

window.DG_GRID_CELL_STYLE = Object.freeze({ resolve: dgResolveGridCellStyle });
