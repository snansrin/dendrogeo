"use strict";

/* Keep park-admin writes behind one adapter without broadening their filters. */
window.DG_PARK_ADMIN_MUTATION_STORE={
  create({getClient}){
    return{
      updatePark(id,patch){return getClient().from("parks").update(patch).eq("id",id);},
      moveProjects(sourceId,destinationId){return getClient().from("projects").update({park_id:destinationId}).eq("park_id",sourceId);},
      moveMeasurements(sourceId,destinationId){return getClient().from("measurements").update({park_id:destinationId}).eq("park_id",sourceId);},
      deletePark(id){return getClient().from("parks").delete().eq("id",id);}
    };
  }
};
