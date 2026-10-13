"use strict";
(function(root){
 function render(message,isError,element){
  if(!element)return false;
  element.textContent=message;
  element.style.color=isError?"var(--red)":"var(--green-dk)";
  return true;
 }
 root.DG_RENDER_AUTH_MESSAGE=Object.freeze({render});
})(window);
