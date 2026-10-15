"use strict";

/* Keep backup download, picker activation, and restore selection in UI ownership. */
(function(root){
 function bind({document}){
  if(root._dgBackupActionsBound)return;
  root._dgBackupActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-backup-action="download"], [data-dg-backup-action="pick-file"]');
   if(!element)return;
   if(element.dataset.dgBackupAction==="download")root.fullBackup();
   if(element.dataset.dgBackupAction==="pick-file")document.getElementById("dgRestoreFile")?.click();
  });
  document.addEventListener("change",event=>{
   const element=event.target?.closest?.('[data-dg-backup-action="restore-file"]');
   if(element)root.dgRestorePick(event);
  });
 }
 root.DG_BACKUP_ACTIONS=Object.freeze({bind});
})(window);

window.DG_BACKUP_ACTIONS.bind({document});
