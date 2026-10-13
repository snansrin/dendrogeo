"use strict";
(function(root){
 function read(id,{api,widgets}){
  if(!api||!widgets[id])return null;
  try{return api.getResponse(widgets[id])||null;}catch(error){return null;}
 }
 root.DG_TURNSTILE_TOKEN=Object.freeze({read});
})(window);
