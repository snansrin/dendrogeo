"use strict";
(function(root){
 async function execute(event,projectId,ports){
  if(event){event.preventDefault();event.stopPropagation();}
  if(!ports.confirm(ports.confirmation))return {status:"cancelled"};
  try{
   const{error}=await ports.deleteProject(projectId);
   if(error){ports.failure(error);return {status:"failed",error};}
   try{ports.markLiveDirty();}catch(ignored){}
   ports.success();
   if(ports.redraw)ports.redraw();
   if(ports.refresh)ports.refresh();
   return {status:"deleted"};
  }catch(error){
   ports.failure(error);
   return {status:"failed",error};
  }
 }
 root.DG_DELETE_ADMIN_TREE_PROJECT=Object.freeze({execute});
})(window);
