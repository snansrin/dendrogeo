"use strict";
(function(root){
 function execute(backup,ports){
  try{
   if(!ports.confirm(ports.prompt(backup)))return{status:"cancelled"};
   const{sql,count}=ports.build(backup);
   if(!count){ports.onInvalid();return{status:"invalid",count:0};}
   ports.download(sql,ports.filename());
   ports.onSuccess();
   return{status:"downloaded",count};
  }catch(error){ports.onFailure(error);return{status:"failed",error};}
 }
 root.DG_RESTORE_BACKUP_APPLICATION=Object.freeze({execute});
})(window);
