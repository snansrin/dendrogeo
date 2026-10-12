"use strict";
(function(root){
 async function read(buildQuery,{pageSize=1000}={}){
  const rows=[];
  for(let from=0;;from+=pageSize){
   const{data,error}=await buildQuery().order("created_at").range(from,from+pageSize-1);
   if(error)throw new Error(error.message);
   rows.push(...(data||[]));
   if(!data||data.length<pageSize)break;
  }
  return rows;
 }
 root.DG_READ_ADMIN_EXPORT_ROWS=Object.freeze({read});
})(window);
