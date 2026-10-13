"use strict";

/* Prefer the analyzed park CRS; otherwise derive UTM from the first cell. */
window.DG_SELECT_SENTINEL_PROFILE_EPSG={
  select(cells,requested,epsgForLatLon){
    return requested||epsgForLatLon(cells[0].center.lat,cells[0].center.lon);
  }
};
