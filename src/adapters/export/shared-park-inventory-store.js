"use strict";
/* Paginated RLS-scoped reads; no service role, view, schema or auth-policy changes. */
(function(root){
 const PAGE=1000,sortPoints=root.DG_SHARED_PARK_INVENTORY_DOMAIN.sortPoints;
 const PROJECT_FIELDS="id,owner,name,park_id,park_name,parks!projects_park_id_fkey(id,name,area_m2)";
 async function pages(makeQuery){
  const rows=[];
  for(let from=0;;from+=PAGE){
   const {data,error}=await makeQuery().range(from,from+PAGE-1);
   if(error)throw Error(error.message);
   rows.push(...(data||[]));
   if(!data||data.length<PAGE)break;
  }
  return rows;
 }
 async function listInventoryProjects(client){
  return pages(()=>client.from("projects").select(PROJECT_FIELDS).order("id",{ascending:true}));
 }
 async function isCurrentParticipant(client,userId){
  if(!userId)return false;
  const {data,error}=await client.auth.getUser();
  return !error&&data?.user?.id===userId;
 }
 /* The project directory is the canonical participant scope. Reusing its two
    readers prevents export-only role rules from widening the UI's project list
    (in particular, one administrator-issued park invite must not add every
    project in that park to a participant's selector). */
 async function listParticipantInventoryProjects(client,{userId,role}={}){
  if(!userId)return [];
  const owned=await root.DG_OWNED_MEASUREMENT_PROJECTS.fetch({client,userId,onRelationError:()=>{}});
  let shared=[],sharingError=null;
  try{shared=await root.DG_SHARED_MEASUREMENT_PROJECTS.fetch({client,userId,ownedProjects:owned});}
  catch(error){sharingError=error;}
  const projects=root.DG_MERGE_MEASUREMENT_PROJECTS.merge(owned,shared);
  if(sharingError)Object.defineProperty(projects,"sharingError",{value:sharingError});
  return projects;
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
  root.DG_SHARED_PARK_INVENTORY_STORE=Object.freeze({listProjects:listInventoryProjects,listParticipantProjects:listParticipantInventoryProjects,isCurrentParticipant,readAll});
})(window);
