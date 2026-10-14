"use strict";

/* Keep park-admin writes behind one adapter without broadening their filters. */
window.DG_PARK_ADMIN_MUTATION_STORE={
  create({getClient}){
    return{
      async updatePark(id,patch){const result=await getClient().from("parks").update(patch).eq("id",id).select("id");return result?.error||result?.data?.length?result:{...result,error:{message:"Park güncellenmedi. Yetkiyi ve park kaydını kontrol edin."}};},
      moveProjects(sourceId,destinationId){return getClient().from("projects").update({park_id:destinationId}).eq("park_id",sourceId);},
      moveMeasurements(sourceId,destinationId){return getClient().from("measurements").update({park_id:destinationId}).eq("park_id",sourceId);},
      async deletePark(id){const result=await getClient().from("parks").delete().eq("id",id).select("id");return result?.error||result?.data?.length?result:{...result,error:{message:"Park silinmedi. Yetkiyi ve park kaydını kontrol edin."}};}
    };
  }
};
