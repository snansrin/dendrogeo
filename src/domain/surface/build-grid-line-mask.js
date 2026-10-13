"use strict";

/* Buffer line segments and vertices into metric exclusion polygons. */
window.DG_BUILD_GRID_LINE_MASK={
  build(line,epsg,{project}){
    const points=project(line.pts.map(point=>[point[1],point[0]]),epsg),width=Math.max(.1,Number(line.w)||1),polygons=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
      const ox=-dy/length*width,oy=dx/length*width;
      polygons.push([[[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],[b[0]-ox,b[1]-oy],[a[0]-ox,a[1]-oy],[a[0]+ox,a[1]+oy]]]);
    }
    for(const point of points)polygons.push([Array.from({length:17},(_,i)=>[point[0]+Math.cos(i*Math.PI/8)*width,point[1]+Math.sin(i*Math.PI/8)*width])]);
    return polygons;
  }
};
