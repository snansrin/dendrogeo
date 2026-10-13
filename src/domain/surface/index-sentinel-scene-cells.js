"use strict";

/* Map each cell center into each band's own projected raster window. */
window.DG_INDEX_SENTINEL_SCENE_CELLS={
  build({cells,bands,project,indexFor}){
    const result={};
    for(const [name,band] of Object.entries(bands))result[name]=cells.map(cell=>{
      const point=project(cell.center.lat,cell.center.lon,band.epsg);
      return indexFor(band.meta,band.win,point.x,point.y);
    });
    return result;
  }
};
