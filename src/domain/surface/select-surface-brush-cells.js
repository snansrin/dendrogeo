"use strict";

/* Select raster cells touched by a park-clipped metric brush stroke. */
window.DG_SURFACE_BRUSH_CELL_SELECTION={
  select({points,diameter,epsg,polygonClipping,parkGeometry,geometry,cells,cellKey,gridLineMask,bounds,overlap,area}){
    if(!polygonClipping||!parkGeometry||!geometry)return[];
    const masks=gridLineMask({pts:points,w:diameter/2},epsg);if(!masks.length)return[];
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
