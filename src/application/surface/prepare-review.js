"use strict";
/* Prepare review geometry through the worker, with a bounded fallback path. */
(function(root){
 function create({runWorker,park,objects,cell,resolved,yieldTask}){
  return async function prepare(data){
   const result=await runWorker(data);if(result)return result;
   // Older browsers / worker load failures: yield between bounded geometry batches.
   const parkGeometry=park(data.outer,data.holes,data.epsg),geometries={},parts=[];
   const osmObjects=data.objects||objects(data.elements||[],data.epsg);
   const features=[...(data.useObjects!==false?osmObjects:[]),...data.features];
   for(let i=0;i<data.cells.length;i+=128){
    const batch=data.cells.slice(i,i+128);
    for(const c of batch)geometries[c.row+':'+c.col]=cell(c,parkGeometry,data.epsg);
    parts.push(...resolved(batch,c=>c.classKey,geometries,features,data.epsg,parkGeometry));
    await yieldTask();
   }
   return{park:parkGeometry,geometries,objects:osmObjects,parts};
  };
 }
 root.DG_SURFACE_REVIEW_PREPARATION=Object.freeze({create});
})(window);
