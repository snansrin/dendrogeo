"use strict";
(function(root){
 function show(event,getModal){
  if(event!=="PASSWORD_RECOVERY")return false;
  const modal=getModal();
  if(modal)modal.style.display="flex";
  return !!modal;
 }
 root.DG_SHOW_PASSWORD_RECOVERY=Object.freeze({show});
})(window);
