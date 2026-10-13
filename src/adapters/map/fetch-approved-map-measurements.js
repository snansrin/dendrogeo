"use strict";

window.DG_FETCH_APPROVED_MAP_MEASUREMENTS={
  async fetch({client,limit,warnIfTruncated}){
    const{data,count,error}=await client.from("measurements")
      .select("lat,lon,point_id,species,dbh_cm,height_m,carbon_kg,photo_url,grp",{count:"exact"})
      .eq("status","Onaylı").limit(limit);
    if(error)throw new Error((error.code?error.code+": ":"")+error.message);
    warnIfTruncated(data,limit,"Canlı harita",count);
    return{data,count};
  }
};
