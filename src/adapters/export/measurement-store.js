"use strict";
(function(root){
 function create(getClient,getUserId){
  async function load(){
   const client=getClient(),userId=getUserId();let output=[],from=0;const step=1000;
   for(;;){
    const{data}=await client.from("measurements").select("*,projects(name)").eq("owner",userId).order("created_at",{ascending:false}).range(from,from+step-1);
    output=output.concat(data||[]);if(!data||data.length<step)break;from+=step;
   }
   return output;
  }
  return Object.freeze({load});
 }
 root.DG_EXPORT_MEASUREMENT_STORE=Object.freeze({create});
})(window);
