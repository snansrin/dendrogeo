"use strict";

/* Load one park through the measurement adapter boundary. */
window.DG_FETCH_MEASUREMENT_PARK={
  async fetch({client,id}){
    const{data}=await client.from("parks").select("*").eq("id",id).maybeSingle();
    return data||null;
  }
};
