"use strict";
/* Resolve Sentinel asset CRS and pixel windows in each asset's own UTM grid. */
(function(root){
  function assetEpsg(image){try{const keys=typeof image.getGeoKeys==="function"?image.getGeoKeys():null,k=Math.round(Number(keys&&keys.ProjectedCSTypeGeoKey||0));if((k>=32601&&k<=32660)||(k>=32701&&k<=32760))return k;}catch(e){/* missing keys */}throw Error("Sentinel-2 bant koordinat sistemi eksik veya desteklenmiyor; sahne kullanılmadı.");}
  function utmBbox(bboxDeg,epsg,project){const corners=[[bboxDeg.minLat,bboxDeg.minLon],[bboxDeg.minLat,bboxDeg.maxLon],[bboxDeg.maxLat,bboxDeg.minLon],[bboxDeg.maxLat,bboxDeg.maxLon]];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const corner of corners){const point=project(corner[0],corner[1],epsg);minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}return{minX,minY,maxX,maxY};}
  function cellIndex(meta,win,x,y){const col=Math.floor((x-meta.minX)/meta.dx),row=Math.floor((meta.maxY-y)/meta.dy),localCol=col-win[0],localRow=row-win[1],width=win[2]-win[0],height=win[3]-win[1];if(localCol<0||localRow<0||localCol>=width||localRow>=height)return null;return localRow*width+localCol;}
  async function readBand(image,bboxDeg,{getMeta,windowFor,project}){const epsg=assetEpsg(image),meta=getMeta(image),win=windowFor(meta,utmBbox(bboxDeg,epsg,project)),values=await image.readRasters({window:win,samples:[0],interleave:true});return{meta,win,values,epsg};}
  root.DG_SENTINEL_RASTER_GRID=Object.freeze({assetEpsg,utmBbox,cellIndex,readBand});
})(window);
