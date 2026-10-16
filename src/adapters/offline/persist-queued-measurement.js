"use strict";

/* Keep the existing owner-filtered update and insert request shapes intact. */
window.DG_PERSIST_QUEUED_MEASUREMENT={
  async save({client,payload,editId,owner,baseline}){
    if(!editId)return client.from("measurements").insert(payload).select("id");
    return window.DG_UPDATE_MEASUREMENT_IF_CURRENT.update({client,payload,editId,owner,baseline});
  }
};
