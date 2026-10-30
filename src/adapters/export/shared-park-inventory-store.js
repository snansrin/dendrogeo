"use strict";
/* Paginated RLS-scoped reads; no service role, view, schema or auth-policy changes. */
(function(root){
 const PAGE=1000,sortPoints=root.DG_SHARED_PARK_INVENTORY_DOMAIN.sortPoints;
 const PROJECT_FIELDS="id,owner,name,park_id,park_name,parks(id,name,area_m2)";
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
 /* Participant export must never inherit an administrator's unrestricted projects SELECT.
    Only owned projects or projects backed by a CURRENT, verified accepted invitation
    and collaborator membership can appear in the non-admin export selector. */
 async function listParticipantInventoryProjects(client,{userId,role}={}){
  if(!userId)return [];
  const owned=await pages(()=>client.from("projects").select(PROJECT_FIELDS).eq("owner",userId).order("id",{ascending:true}));
  const memberships=await pages(()=>client.from("park_collaborators").select("park_id,added_at").eq("user_id",userId).order("park_id",{ascending:true}));
  if(!memberships.length)return owned;
  const {data:auth,error:authError}=await client.auth.getUser();
  const verified=auth?.user;
  if(authError||verified?.id!==userId||!verified?.email||!verified.email_confirmed_at)return owned;
  const invites=await pages(()=>client.from("park_invites").select("park_id,invited_by,responded_at").eq("status","Kabul").eq("email",verified.email.trim().toLowerCase()).order("park_id",{ascending:true}));
  const members=new Map(memberships.map(row=>[Number(row.park_id),Date.parse(row.added_at)]));
  const accepted=invites.filter(invite=>{
   const joined=members.get(Number(invite.park_id)),acceptedAt=Date.parse(invite.responded_at);
   return Number.isFinite(joined)&&Number.isFinite(acceptedAt)&&acceptedAt>=joined;
  });
  if(!accepted.length)return owned;
  // RLS validates invitation issuer and owner for ordinary participants. Admins
  // bypass that RLS, so their participant selector must check issuers explicitly.
  const privileged=role===undefined||["admin","owner"].includes(role);
  let senders=new Map();
  if(privileged){
   const ids=[...new Set(accepted.map(invite=>invite.invited_by).filter(Boolean))];
   if(!ids.length)return owned;
   const senderRows=await pages(()=>client.from("profiles").select("id,role,active").in("id",ids).order("id",{ascending:true}));
   senders=new Map(senderRows.filter(row=>row.active===true).map(row=>[row.id,row]));
  }
  const parks=[...new Set(accepted.map(invite=>Number(invite.park_id)).filter(Boolean))];
  const shared=[];
  for(let start=0;start<parks.length;start+=100){
   const ids=parks.slice(start,start+100);
   const projects=await pages(()=>client.from("projects").select(PROJECT_FIELDS).in("park_id",ids).order("id",{ascending:true}));
   for(const project of projects){
    if(accepted.some(invite=>Number(invite.park_id)===Number(project.park_id)&&(
     !privileged||(()=>{const sender=senders.get(invite.invited_by);return sender&&(invite.invited_by===project.owner||["admin","owner"].includes(sender.role));})()
    )))shared.push(project);
   }
  }
  return [...new Map([...owned,...shared].map(project=>[Number(project.id),project])).values()];
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
  root.DG_SHARED_PARK_INVENTORY_STORE=Object.freeze({listProjects:listInventoryProjects,listParticipantProjects:listParticipantInventoryProjects,readAll});
})(window);
