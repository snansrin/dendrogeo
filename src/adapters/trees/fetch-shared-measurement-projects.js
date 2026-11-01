"use strict";

/* A park membership is not, by itself, permission to read every project
 * created by other owners in that park. Match a current accepted invitation
 * to the project's owner as well as the membership epoch. A founder/admin
 * may be allowed to read other rows by RLS, but those rows must not leak into
 * the *collaborator project picker*. Server-side RLS remains authoritative. */
window.DG_SHARED_MEASUREMENT_PROJECTS={
  async fetch({client,ownedProjects,listMyParks,userId}){
    try{
      if(!userId||typeof listMyParks!=="function")return [];
      const shared=(await listMyParks()).filter(park=>park.role==="collaborator");
      const ownedIds=new Set((ownedProjects||[]).map(project=>Number(project.id)));
      const ids=[...new Set(shared.map(park=>Number(park.id)).filter(Boolean))];
      if(!ids.length)return [];
      const{data:auth,error:authError}=await client.auth.getUser();
      const verified=auth?.user;
      if(authError||verified?.id!==userId||!verified.email||!verified.email_confirmed_at)return [];
      const email=verified.email.trim().toLowerCase();
      const{data:members,error:memberError}=await client.from("park_collaborators").select("park_id,added_at").eq("user_id",userId).in("park_id",ids);
      if(memberError)return [];
      const epochs=new Map((members||[]).map(row=>[Number(row.park_id),Date.parse(row.added_at)]));
      const{data:invites,error:inviteError}=await client.from("park_invites").select("park_id,invited_by,responded_at").eq("status","Kabul").eq("email",email).in("park_id",ids);
      if(inviteError)return [];
      const accepted=(invites||[]).filter(invite=>{
        const joinedAt=epochs.get(Number(invite.park_id)),acceptedAt=Date.parse(invite.responded_at);
        return Number.isFinite(joinedAt)&&Number.isFinite(acceptedAt)&&acceptedAt>=joinedAt;
      });
      if(!accepted.length)return [];
      const allowedParks=[...new Set(accepted.map(invite=>Number(invite.park_id)))];
      const{data,error}=await client.from("projects").select("*,parks(id,name,city,country,area_m2)").in("park_id",allowedParks);
      if(error)return [];
      const candidates=(data||[]).filter(project=>!ownedIds.has(Number(project.id)));
      return candidates.filter(project=>accepted.some(invite=>Number(invite.park_id)===Number(project.park_id)&&invite.invited_by===project.owner)).map(project=>{
        const park=shared.find(row=>Number(row.id)===Number(project.park_id));
        project.shared=true;
        if(park&&!project.parks)project.parks={id:park.id,name:park.name,city:park.city,country:park.country,area_m2:park.area_m2};
        return project;
      });
    }catch(error){return [];}
  }
};
