"use strict";

/* Prefer a pending manual point, then the park anchor, then current GPS. */
window.DG_RESOLVE_MANUAL_PARK_COORDINATE={
  resolve({pending,anchor,gps}){
    return pending||anchor||(gps?{lat:gps.latitude,lon:gps.longitude}:null);
  }
};
