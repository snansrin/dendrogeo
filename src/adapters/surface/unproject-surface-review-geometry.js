"use strict";

/* Convert projected review geometry back to WGS84 and reuse cached conversions. */
window.DG_UNPROJECT_SURFACE_REVIEW_GEOMETRY={
  unproject(geometry,epsg,{cache,inverse}){
    const old=cache.get(geometry);
    if(old?.epsg===epsg)return old.wgs;
    const wgs=geometry.map(polygon=>polygon.map(ring=>ring.map(point=>{const projected=inverse(point[0],point[1],epsg);return[projected.lon,projected.lat];})));
    cache.set(geometry,{epsg,wgs});
    return wgs;
  }
};
