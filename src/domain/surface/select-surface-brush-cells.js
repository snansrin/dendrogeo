"use strict";

/* Select raster cells touched by a park-clipped metric brush stroke. */
window.DG_SURFACE_BRUSH_CELL_SELECTION={
  select({points,diameter,epsg,polygonClipping,parkGeometry,geometry,cells,cellKey,gridLineMask,bounds,overlap,area}){
    if(!polygonClipping||!parkGeometry||!geometry)return[];
    const minSpacing=Math.max(1,diameter/2),sampled=[];
    for(const point of points||[]){
      if(!Array.isArray(point)||point.length<2)continue;
      if(!sampled.length){sampled.push(point);continue;}
      const previous=sampled[sampled.length-1],distance=Math.hypot((Number(point[0])-Number(previous[0]))*111320,(Number(point[1])-Number(previous[1]))*111320*Math.cos(Number(point[0])*Math.PI/180));
      if(distance>=minSpacing)sampled.push(point);
    }
    const finalPoint=points?.at?.(-1);if(finalPoint&&sampled.at(-1)!==finalPoint)sampled.push(finalPoint);
    const masks=gridLineMask({pts:sampled.length?sampled:points,w:diameter/2},epsg);if(!masks.length)return[];
    const brush=polygonClipping.intersection(polygonClipping.union(...masks),parkGeometry);if(!brush.length)return[];
    const brushBounds=bounds(brush),keys=[];
    for(const cell of cells||[]){
      const key=cellKey(cell),cellGeometry=geometry[key];if(!cellGeometry?.length)continue;
      if(!overlap(brushBounds,cellGeometry))continue;
      if(area(polygonClipping.intersection(cellGeometry,brush))>.01)keys.push(key);
    }
    return keys;
  }
};
