"use strict";

/*
 * DendroGeo shared geospatial utilities.
 *
 * Coordinates in the application are WGS84 [lat, lon].
 * ArcGIS Sentinel-2 10 m ImageServer uses Web Mercator (EPSG:3857).
 *
 * These conversion helpers intentionally live in a dependency that is
 * loaded BEFORE gridplan.js. Keeping them here prevents the LULC engine
 * from depending on a helper declared inside a large feature module and
 * gives cached gridplan builds a stable runtime dependency.
 */

function hav(a,b,c,d){
  const R=6371000,r=Math.PI/180;
  const x=
    Math.sin((c-a)*r/2)**2+
    Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function brg(a,b,c,d){
  const r=Math.PI/180;
  const y=Math.sin((d-b)*r)*Math.cos(c*r);
  const x=
    Math.cos(a*r)*Math.sin(c*r)-
    Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);
  return (Math.atan2(y,x)/r+360)%360;
}

function dgLonLatToWebMercator(lat,lon){
  const la=Math.max(
    -85.0511287798,
    Math.min(85.0511287798,Number(lat))
  );
  const lo=Number(lon);

  if(!Number.isFinite(la)||!Number.isFinite(lo)){
    throw new Error("Geçersiz WGS84 koordinatı.");
  }

  const R=6378137;
  const x=R*lo*Math.PI/180;
  const y=R*Math.log(
    Math.tan(
      Math.PI/4+
      la*Math.PI/360
    )
  );

  return{x,y};
}

function dgWebMercatorToLonLat(x,y){
  const X=Number(x);
  const Y=Number(y);

  if(!Number.isFinite(X)||!Number.isFinite(Y)){
    return null;
  }

  const R=6378137;

  return{
    lon:X/R*180/Math.PI,
    lat:(
      2*Math.atan(
        Math.exp(Y/R)
      )-
      Math.PI/2
    )*180/Math.PI
  };
}

window.DENDROGEO_GEO_UTILS_VERSION="2.0.0";
window.dgLonLatToWebMercator=dgLonLatToWebMercator;
window.dgWebMercatorToLonLat=dgWebMercatorToLonLat;
