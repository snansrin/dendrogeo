"use strict";

/* Preserve newest-first admin requests and the single-FK profile embed. */
window.DG_DATA_REQUEST_QUEUE_STORE={
 load(client){
  return client.from("data_requests").select("*,profiles(full_name)").order("created_at",{ascending:false});
 }
};
