"use strict";

/* Fetch exactly one measurement using the existing primary-key scope. */
window.DG_FETCH_MEASUREMENT_FOR_EDIT={
  async fetch({client,id}){
    const{data}=await client.from("measurements").select("*").eq("id",id).single();
    return data||null;
  }
};
