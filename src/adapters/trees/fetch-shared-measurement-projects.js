"use strict";

/* Read collaborator-owned projects without changing the existing role/query gate. */
window.DG_SHARED_MEASUREMENT_PROJECTS={
  async fetch({client,ownedProjects,listMyParks}){
    try{
      if(typeof listMyParks!=="function")return [];
      const shared=(await listMyParks()).filter(park=>park.role==="collaborator");
      const ownParkIds=new Set((ownedProjects||[]).map(project=>Number(project.park_id)).filter(Boolean));
      const ids=shared.map(park=>Number(park.id)).filter(id=>id&&!ownParkIds.has(id));
      if(!ids.length)return [];
      const{data,error}=await client.from("projects").select("*,parks(id,name,city,country,area_m2)").in("park_id",ids);
      return error?[]:(data||[]).map(project=>{
        const park=shared.find(row=>Number(row.id)===Number(project.park_id));
        project.shared=true;
        if(park&&!project.parks)project.parks={id:park.id,name:park.name,city:park.city,country:park.country,area_m2:park.area_m2};
        return project;
      });
    }catch(error){return [];}
  }
};
