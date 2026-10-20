"use strict";
window.DG_BACKUP_PAGED_STORE={
 async load(client,table,orderCol){
  let out=[],from=0,step=1000;
  for(;;){
   let query=client.from(table).select("*").order(orderCol);
   if(table==="surface_reviews")query=query.order("owner");
   else if(orderCol!=="id")query=query.order("id");
   const {data,error}=await query.range(from,from+step-1);
   if(error)throw new Error(table+": "+error.message);
   out=out.concat(data||[]);
   if(!data||data.length<step)break;
   from+=step;
  }
  return out;
 }
};
