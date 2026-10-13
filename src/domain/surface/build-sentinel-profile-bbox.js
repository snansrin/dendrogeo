"use strict";

/* Build the slightly expanded WGS84 window used to collect edge-cell pixels. */
window.DG_BUILD_SENTINEL_PROFILE_BBOX={
  build(cells){
    const latitudes=cells.map(cell=>cell.center.lat),longitudes=cells.map(cell=>cell.center.lon);
    return{
      minLat:Math.min(...latitudes)-0.0002,
      maxLat:Math.max(...latitudes)+0.0002,
      minLon:Math.min(...longitudes)-0.0003,
      maxLon:Math.max(...longitudes)+0.0003
    };
  }
};
