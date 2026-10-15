"use strict";
(function(root){
 function show(event,getModal){
  if(event!=="PASSWORD_RECOVERY")return false;
  const modal=getModal();
  if(modal)modal.style.display="flex";
  return !!modal;
 }
 function hide(getModal){
  const modal=getModal();
  if(!modal)return false;
  modal.style.display="none";
  return true;
 }
 root.DG_SHOW_PASSWORD_RECOVERY=Object.freeze({show,hide});
})(window);
