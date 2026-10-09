"use strict";
/* Runtime shape checks for persisted, user-reviewed surface features.
 * No map, raster, geometry engine, or storage dependency. */
(function(root){
  const types=Object.freeze({
    green:Object.freeze({group:"green",label:"Yeşil alan"}),
    hard:Object.freeze({group:"hard",label:"Sert zemin"}),
    building:Object.freeze({group:"building",label:"Bina"}),
    water:Object.freeze({group:"water",label:"Su"}),
    pool:Object.freeze({group:"pool",label:"Havuz / süs havuzu"}),
    bare:Object.freeze({group:"bare",label:"Çıplak zemin"}),
    other:Object.freeze({group:"other",label:"Diğer"})
  });
  function isValidRing(ring){
    if(!Array.isArray(ring)||ring.length<3||ring.length>300||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))return false;
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){
      if(j===i+1||(i===0&&j===ring.length-1))continue;
      const a=ring[i],b=ring[(i+1)%ring.length],c=ring[j],d=ring[(j+1)%ring.length];
      if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))return false;
    }
    return true;
  }
  function isValidFeature(feature){
    if(!feature||typeof feature!=="object"||!types[feature.type])return false;
    if(feature.ring)return isValidRing(feature.ring);
    const geometry=feature.geometry;
    if(geometry?.type!=="MultiPolygon"||!Array.isArray(geometry.coordinates)||!geometry.coordinates.length||geometry.coordinates.length>1000)return false;
    let points=0;
    for(const polygon of geometry.coordinates){
      if(!Array.isArray(polygon)||!polygon.length)return false;
      for(const ring of polygon){
        if(!Array.isArray(ring)||ring.length<4||(points+=ring.length)>20000)return false;
        if(ring.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90))return false;
        if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return false;
      }
    }
    return true;
  }
  root.DG_SURFACE_REVIEW_CONTRACTS=Object.freeze({types,isValidRing,isValidFeature});
})(typeof window!=="undefined"?window:globalThis);
