"use strict";

window.DG_PREPARE_APPROVED_MAP_MEASUREMENTS={
  prepare(rows,isValidCoordinate){return(rows||[]).filter(row=>isValidCoordinate(row.lat,row.lon));}
};
