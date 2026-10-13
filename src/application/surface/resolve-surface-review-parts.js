"use strict";

/* Resolve cached overlays into per-cell surface classes and measured areas. */
window.DG_RESOLVE_SURFACE_REVIEW_PARTS={
  resolve({cells,classFor,geometries,features,epsg,park,types,partCache,maskCache,select,prepareMasks,resolveCell,bounds,overlap,clip,geometry,area,seed}){
    if(!Array.isArray(cells)||!cells.length||!geometries||typeof geometries!=="object"||!Array.isArray(park)||!park.length)return[];
    const sourceFeatures=features||[],overlays=select(sourceFeatures,types),cached=partCache.get(geometries);
    if(cached&&cached.park===park&&cached.epsg===epsg&&cached.cellCount===cells.length&&cached.cellFirst===cells[0]&&cached.features.length===sourceFeatures.length&&cached.features.every((feature,index)=>feature===sourceFeatures[index]))return cached.parts.map(part=>{
      if(part.method!=="review-cell")return part;
      const type=classFor(part.cell)||"other";
      return{...part,type,group:types[type]?.group||"other"};
    });
    const masks=prepareMasks(overlays,{park,epsg,cache:maskCache,geometry,clip,bounds}),parts=[];
    for(const cell of cells){
      const key=cell.row+":"+cell.col,cellGeometry=geometries[key];
      parts.push(...resolveCell(cell,cellGeometry,masks,{area,overlap:{bounds, matches:overlap},clip,types,classFor}));
    }
    seed(geometries,sourceFeatures,epsg,park,parts,cells);
    return parts;
  }
};
