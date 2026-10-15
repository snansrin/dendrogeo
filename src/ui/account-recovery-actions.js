"use strict";

/* Bind recovery-dialog controls to the existing account recovery service. */
(function(root){
 function bind({document}){
  if(root._dgAccountRecoveryActionsBound)return;
  root._dgAccountRecoveryActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.("[data-dg-account-action]");if(!element)return;
   if(element.dataset.dgAccountAction==="save-recovery-password")root.saveNewPassword();
   if(element.dataset.dgAccountAction==="cancel-recovery")root.cancelRecovery();
  });
 }
 root.DG_ACCOUNT_RECOVERY_ACTIONS=Object.freeze({bind});
})(window);

window.DG_ACCOUNT_RECOVERY_ACTIONS.bind({document});
