"use strict";

/* Report a committed rename if its follow-up project-name sync rejects. */
(function(root){
  const rename=root.dgParkRename;
  if(typeof rename!=="function"||root.__DG_PARK_RENAME_FEEDBACK_GUARDED)return;
  root.dgParkRename=async function guardedParkRename(id){
    try{return await rename(id);}catch(error){
      const message=String(error?.message||error);
      root.toast("Park adı kaydedildi ancak proje adları eşitlenemedi: "+message,"warn","🌳");
      if(typeof root.dgAfterParkAdminChange==="function")await root.dgAfterParkAdminChange();
      return false;
    }
  };
  root.__DG_PARK_RENAME_FEEDBACK_GUARDED=true;
})(window);
