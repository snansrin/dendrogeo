"use strict";

/* Preserve the current user's pending-request lookup and insert contracts. */
window.DG_DATA_REQUEST_SUBMIT_STORE={
 pending(client,userId){
  return client.from("data_requests")
   .select("country,city,project_name,status")
   .eq("user_id",userId)
   .in("status",["Beklemede","İşleme Alındı"]);
 },
 insert(client,body){
  return client.from("data_requests").insert(body);
 }
};
