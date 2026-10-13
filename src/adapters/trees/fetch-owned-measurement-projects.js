"use strict";

/* Read owned projects with the established parks relation and old-schema fallback. */
window.DG_OWNED_MEASUREMENT_PROJECTS={
  async fetch({client,userId,onRelationError}){
    let{data,error}=await client.from("projects").select("*,parks(id,name,city,country,area_m2)").eq("owner",userId);
    if(error){
      onRelationError("projects↔parks: "+error.message);
      const fallback=await client.from("projects").select("*").eq("owner",userId);
      data=fallback.data||[];
    }
    return data||[];
  }
};
