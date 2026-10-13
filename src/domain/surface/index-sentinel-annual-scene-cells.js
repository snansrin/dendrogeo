"use strict";

/* Index annual scene cells separately in each raster band's own projection. */
window.DG_INDEX_SENTINEL_ANNUAL_SCENE_CELLS={
  build({cells,bands,project,indexFor}){
    const indices={};
    for(const name of ["SCL","B03","B04","B08","B11"]){
      const band=bands[name];
      indices[name]=cells.map(cell=>{
        const point=project(cell.center.lat,cell.center.lon,band.epsg);
        return indexFor(band.meta,band.win,point.x,point.y);
      });
    }
    return indices;
  }
};
