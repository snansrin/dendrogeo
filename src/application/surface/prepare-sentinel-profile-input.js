"use strict";

/* Validate and normalize the cell, CRS and WGS84 window for a profile scan. */
window.DG_PREPARE_SENTINEL_PROFILE_INPUT={
  prepare({cells,requestedEpsg},{buildBbox,selectEpsg,epsgForLatLon}){
    if(!cells||!cells.length)throw new Error("Spektral tarama için hücre listesi yok (önce arazi örtüsü analizi).");
    return{
      cells,
      bbox:buildBbox(cells),
      epsg:selectEpsg(cells,requestedEpsg,epsgForLatLon)
    };
  }
};
