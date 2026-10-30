"use strict";
/* Paginated RLS-scoped reads; no service role, view, schema or auth-policy changes. */
(function(root){
 const PAGE=1000,sortPoints=root.DG_SHARED_PARK_INVENTORY_DOMAIN.sortPoints;
async function listInventoryProjects(client){
  const rows=[];
  for(let from=0;;from+=PAGE){
   const {data,error}=await client.from("projects").select("id,name,park_id,park_name,parks(id,name,area_m2)").order("id",{ascending:true}).range(from,from+PAGE-1);
   if(error)throw Error(error.message);
   rows.push(...(data||[]));
   if(!data||data.length<PAGE)break;
  }
  return rows;
 }
 async function readAll(client,projectIds,filters={}){
  if(!projectIds.length)return [];
  const rows=[];
  // Chunk projects to avoid an oversized PostgREST URL for administrator exports.
  for(let chunk=0;chunk<projectIds.length;chunk+=100){
   const ids=projectIds.slice(chunk,chunk+100);
   for(let from=0;;from+=PAGE){
    let query=client.from("measurements").select("*").in("project_id",ids);
    if(filters.country)query=query.eq("country",filters.country);
    if(filters.city)query=query.eq("city",filters.city);
    if(filters.status)query=query.eq("status",filters.status);
    const {data,error}=await query.order("point_id",{ascending:true}).order("measurement_no",{ascending:true}).order("id",{ascending:true}).range(from,from+PAGE-1);
    if(error)throw Error(error.message);
    rows.push(...(data||[]));
    if(!data||data.length<PAGE)break;
   }
  }
  return rows.sort(sortPoints);
 }
  root.DG_SHARED_PARK_INVENTORY_STORE=Object.freeze({listProjects:listInventoryProjects,readAll});
})(window);
