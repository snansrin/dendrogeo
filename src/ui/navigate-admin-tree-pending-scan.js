"use strict";
(function(root){
 function navigate(event,startParkScan){
  if(event&&event.preventDefault){event.preventDefault();event.stopPropagation();}
  if(typeof startParkScan==="function")return startParkScan({returnTo:"admin"});
 }
 root.DG_NAVIGATE_ADMIN_TREE_PENDING_SCAN=Object.freeze({navigate});
})(window);
