"use strict";

/* Preserve the signed-in user's newest-first request list query. */
window.DG_MY_DATA_REQUESTS_STORE={
 load(client,userId){
  return client.from("data_requests").select("*").eq("user_id",userId).order("created_at",{ascending:false});
 }
};
