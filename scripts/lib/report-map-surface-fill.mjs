/* Rasterizes polygon rings into the report PNG canvas using the even-odd fill rule. */
function fillSurfacePolygon(cv,rings,col){
 const pts=rings.flat();let y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))),y1=Math.min(cv.h-1,Math.ceil(Math.max(...pts.map(p=>p[1]))));
 for(let y=y0;y<=y1;y++){const xs=[];for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if((a[1]>y+.5)!==(b[1]>y+.5))xs.push(a[0]+(y+.5-a[1])/(b[1]-a[1])*(b[0]-a[0]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)cv.rect(xs[i],y,xs[i+1],y,col);}
}
