"use strict";
window.DG_BACKUP_PAGED_STORE={
 async load(client,table,orderCol){
  let out=[],from=0,step=1000;
  for(;;){
   const {data,error}=await client.from(table).select("*").order(orderCol).range(from,from+step-1);
   if(error)throw new Error(table+": "+error.message);
   out=out.concat(data||[]);
   if(!data||data.length<step)break;
   from+=step;
  }
  return out;
 }
};
