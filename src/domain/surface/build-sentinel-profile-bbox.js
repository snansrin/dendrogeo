"use strict";

/* Build the slightly expanded WGS84 window used to collect edge-cell pixels. */
window.DG_BUILD_SENTINEL_PROFILE_BBOX={
  build(cells){
    let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
    for(const cell of cells){
      minLat=Math.min(minLat,cell.center.lat);maxLat=Math.max(maxLat,cell.center.lat);
      minLon=Math.min(minLon,cell.center.lon);maxLon=Math.max(maxLon,cell.center.lon);
    }
    return{
      minLat:minLat-0.0002,
      maxLat:maxLat+0.0002,
      minLon:minLon-0.0003,
      maxLon:maxLon+0.0003
    };
  }
};
