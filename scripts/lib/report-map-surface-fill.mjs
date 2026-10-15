/* Rasterizes polygon rings into the report PNG canvas using the even-odd fill rule. */
export function fillSurfacePolygon(cv,rings,col){
 const pts=rings.flat();let y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))),y1=Math.min(cv.h-1,Math.ceil(Math.max(...pts.map(p=>p[1]))));
 for(let y=y0;y<=y1;y++){const xs=[];for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if((a[1]>y+.5)!==(b[1]>y+.5))xs.push(a[0]+(y+.5-a[1])/(b[1]-a[1])*(b[0]-a[0]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){
  // A pixel belongs to the polygon only when its centre lies in this half-open span.
  // Expanding both edges with floor/ceil lets adjacent green polygons erase narrow paths.
  const left=Math.max(0,Math.ceil(xs[i]-.5)),right=Math.min(cv.w-1,Math.ceil(xs[i+1]-.5)-1);
  if(left<=right)cv.rect(left,y,right,y,col);
 }}
}
