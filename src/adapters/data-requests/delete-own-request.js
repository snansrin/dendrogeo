"use strict";

/* Keep deletion constrained by both request ID and the current user. */
window.DG_DELETE_OWN_DATA_REQUEST={
 remove(client,id,userId){
  return client.from("data_requests").delete().eq("id",id).eq("user_id",userId).select("id");
 }
};
