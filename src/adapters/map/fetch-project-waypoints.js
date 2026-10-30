"use strict";

window.DG_FETCH_PROJECT_WAYPOINTS={
  async fetch({client,projectId}){
    const response=await client.from("waypoints").select("*").eq("project_id",projectId).order("wp_id",{ascending:true});
    if(response.error||!response.data?.length)return response;
    // Read only measurement evidence for these project points, under existing RLS.
    // Pagination prevents the API row cap from turning measured points pending.
    const ids=[...new Set(response.data.map(row=>row.wp_id))],measured=new Set();
    for(let start=0;start<ids.length;start+=100){
      for(let offset=0;;offset+=1000){
        const result=await client.from("measurements").select("point_id,status,girth_cm,dbh_cm,height_m")
          .eq("project_id",projectId).in("point_id",ids.slice(start,start+100)).order("id",{ascending:true}).range(offset,offset+999);
        if(result.error)return{data:null,error:result.error};
        for(const row of result.data||[]){
          if(row.status!=="Reddedildi"&&Number(row.girth_cm??row.dbh_cm)>0&&Number(row.height_m)>0)measured.add(Number(row.point_id));
        }
        if((result.data||[]).length<1000)break;
      }
    }
    return{...response,data:response.data.map(row=>({...row,visited:measured.has(Number(row.wp_id))}))};
  }
};
