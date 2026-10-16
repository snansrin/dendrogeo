"use strict";
(function(root){
 function create(getClient){
  return Object.freeze({
   myParks:()=>getClient().from("v_my_parks").select("*"),
   inbox:()=>getClient().from("park_invites").select("id,park_id,email,note,status,created_at,invited_by,parks(id,name,city)").eq("status","Beklemede"),
   collaborations:parkId=>Promise.all([
    getClient().from("park_invites").select("id,email,note,status,created_at,invited_by").eq("park_id",parkId).order("created_at",{ascending:false}).limit(50),
    getClient().from("park_collaborators").select("user_id,added_at,profiles(id,full_name,email)").eq("park_id",parkId).limit(50)
   ]),
   respond:(id,accept)=>getClient().rpc("dg_invite_respond",{p_invite:id,p_accept:!!accept}),
   send:(parkId,email,note)=>getClient().rpc("dg_invite_send",{p_park:parkId,p_email:email,p_note:note}),
   revoke:(parkId,target,kind)=>getClient().rpc("dg_invite_revoke",{p_park:parkId,p_target:target,p_kind:kind}),
   leave:parkId=>getClient().rpc("dg_leave_park",{p_park:parkId})
  });
 }
 root.DG_PARK_INVITE_STORE=Object.freeze({create});
})(window);
