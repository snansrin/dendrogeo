"use strict";
/* Preserve spherical Mercator constants, coordinate order and latitude clamping. */
(function(root){
function forward(lat,lon){
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

function reverse(x,y){
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

root.DG_WEB_MERCATOR_COORDINATES=Object.freeze({forward,reverse});
})(window);
