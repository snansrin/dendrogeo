"use strict";

/* Keep the existing owner-filtered update and insert request shapes intact. */
window.DG_PERSIST_QUEUED_MEASUREMENT={
  async save({client,payload,editId,owner}){
    return editId
      ?client.from("measurements").update(payload).eq("id",editId).eq("owner",owner).select("id")
      :client.from("measurements").insert(payload).select("id");
  }
};
