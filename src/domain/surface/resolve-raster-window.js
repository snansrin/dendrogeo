"use strict";
/* Read COG affine extent and derive the bounded park pixel window. */
(function(root){
  function imageMeta(image){const bbox=image.getBoundingBox(),width=image.getWidth(),height=image.getHeight();if(!Array.isArray(bbox)||bbox.length!==4)throw new Error("COG uzamsal sınır metadatası okunamadı.");return{minX:Number(bbox[0]),minY:Number(bbox[1]),maxX:Number(bbox[2]),maxY:Number(bbox[3]),width,height,dx:(Number(bbox[2])-Number(bbox[0]))/width,dy:(Number(bbox[3])-Number(bbox[1]))/height};}
  function windowForPark(meta,parkBBox){const minCol=Math.max(0,Math.floor((parkBBox.minX-meta.minX)/meta.dx)-1),maxCol=Math.min(meta.width,Math.ceil((parkBBox.maxX-meta.minX)/meta.dx)+1),minRow=Math.max(0,Math.floor((meta.maxY-parkBBox.maxY)/meta.dy)-1),maxRow=Math.min(meta.height,Math.ceil((meta.maxY-parkBBox.minY)/meta.dy)+1);if(maxCol<=minCol||maxRow<=minRow)throw new Error("Park ile 10 m veri karosu arasında piksel kesişimi yok.");return[minCol,minRow,maxCol,maxRow];}
  root.DG_RESOLVE_RASTER_WINDOW=Object.freeze({imageMeta,windowForPark});
})(window);
