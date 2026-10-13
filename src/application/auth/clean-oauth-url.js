"use strict";
(function(root){
 function clean(host){
  try{
   if(host.history&&host.history.replaceState)host.history.replaceState(null,"",host.location.pathname);
  }catch(e){}
 }
 root.DG_CLEAN_OAUTH_URL=Object.freeze({clean});
})(window);
