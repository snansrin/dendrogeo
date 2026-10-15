"use strict";

/* Own the static and rendered user-admin controls without changing their workflows. */
(function(root){
 function bind({document}){
  if(root._dgAdminUserActionsBound)return;
  root._dgAdminUserActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-admin-user-action]');
   if(!element)return;
   switch(element.dataset.dgAdminUserAction){
    case "load":root.loadUsers();break;
    case "toggle":root.toggleU(element.dataset.dgUserId,element.dataset.dgUserActive==="true");break;
   }
  });
  document.addEventListener("input",event=>{
   if(event.target?.closest?.('[data-dg-admin-user-action="filter"]'))root.filterUsers();
  });
  document.addEventListener("change",event=>{
   const element=event.target?.closest?.('[data-dg-admin-user-action]');
   if(!element)return;
   if(element.dataset.dgAdminUserAction==="filter")root.filterUsers();
   if(element.dataset.dgAdminUserAction==="role")root.updateRole(element.dataset.dgUserId,element.value);
  });
 }
 root.DG_ADMIN_USER_ACTIONS=Object.freeze({bind});
})(window);

window.DG_ADMIN_USER_ACTIONS.bind({document});
