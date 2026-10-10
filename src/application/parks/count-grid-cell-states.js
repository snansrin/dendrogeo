"use strict";

/* Count measured and empty cells using the existing zero-measurement rule. */
function dgCountGridCellStates(cells) {
  let measured = 0;
  let empty = 0;
  cells.forEach(cell => {
    if (cell.n === 0) empty++;
    else measured++;
  });
  return { measured, empty, total: cells.length };
}

window.DG_GRID_CELL_STATES = Object.freeze({ count: dgCountGridCellStates });
