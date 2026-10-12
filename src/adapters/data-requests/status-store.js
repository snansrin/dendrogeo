"use strict";

/* Preserve status updates; confirmation, timestamps and error policy belong to the caller. */
window.DG_DATA_REQUEST_STATUS_STORE={
 update(client,id,status,fulfilledAt){
  return client.from("data_requests").update({status,fulfilled_at:fulfilledAt}).eq("id",id);
 }
};
