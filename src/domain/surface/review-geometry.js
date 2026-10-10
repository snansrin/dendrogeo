"use strict";
/* Pure planar geometry summaries for surface review polygons. */
function dgSurfaceReviewArea(geom){
 let total=0;
 for(const poly of geom||[])for(let i=0;i<poly.length;i++){
  const ring=poly[i];let area=0;
  for(let j=0;j<ring.length;j++){
   const p=ring[j],q=ring[(j+1)%ring.length];
   area+=p[0]*q[1]-q[0]*p[1];
  }
  total+=(i?-1:1)*Math.abs(area)/2;
 }
 return Math.max(0,total);
}
function dgSurfaceReviewBounds(geom){
 const pts=(geom||[]).flat(2);
 return pts.reduce((b,p)=>[
  Math.min(b[0],p[0]),Math.min(b[1],p[1]),
  Math.max(b[2],p[0]),Math.max(b[3],p[1])
 ],[Infinity,Infinity,-Infinity,-Infinity]);
}
function dgSurfaceReviewOverlap(a,b){
 return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
}
window.DG_SURFACE_REVIEW_GEOMETRY=Object.freeze({
 area:dgSurfaceReviewArea,bounds:dgSurfaceReviewBounds,overlap:dgSurfaceReviewOverlap
});
