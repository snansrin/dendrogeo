"use strict";

/* Resolve a previous insert only when client and owner identify the same row. */
window.DG_FIND_SAVED_OFFLINE_MEASUREMENT={
  async find({client,data,sameMeasurement}){
    if(!data.client_id)return null;
    const result=await client.from("measurements").select("*").eq("client_id",data.client_id).eq("owner",data.owner).maybeSingle();
    if(result.error)throw new Error(result.error.message);
    return sameMeasurement(data,result.data)?result.data:null;
  }
};
