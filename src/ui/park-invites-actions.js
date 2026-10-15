"use strict";

/* Delegate park invitation refresh controls to the established collaboration service. */
(function(root){
 function bind({document}){
  if(root._dgParkInvitesActionsBound)return;
  root._dgParkInvitesActionsBound=true;
  document.addEventListener("change",event=>{
   const element=event.target?.closest?.('[data-dg-park-invites-action="refresh"]');
   if(element)root.dgCollabRefresh();
  });
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-park-invites-action]');if(!element)return;
   switch(element.dataset.dgParkInvitesAction){
    case "load":root.dgCollabLoad();break;
    case "send":root.dgInviteSend();break;
    case "respond":root.dgInviteRespond(element.dataset.inviteId,element.dataset.accept==="true");break;
    case "revoke":root.dgInviteRevoke(element.dataset.target,element.dataset.kind);break;
   }
  });
 }
 root.DG_PARK_INVITES_ACTIONS=Object.freeze({bind});
})(window);

window.DG_PARK_INVITES_ACTIONS.bind({document});
