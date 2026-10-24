"use strict";
/* No park/analysis mutation before storage, validation and transition approval. */
(function(root){
 function create(ports){
  let busy=false;
  return async function activate(candidate){
   if(busy||ports.isBusy())return false;
   busy=true;
   try{
    if(ports.validate)await ports.validate(candidate);
    if(!await ports.approveTransition())return false;
    if(!ports.isCurrent())return false;
    await ports.draw(candidate);
    return true;
   }finally{busy=false;}
  };
 }
 root.DG_ACTIVATE_STAGE_SCOPE=Object.freeze({create});
})(window);
