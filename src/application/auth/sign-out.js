"use strict";
(function(root){
 async function execute(ports){
  if(ports.stopPresence)ports.stopPresence();
  await ports.signOut();
  ports.reload();
 }
 root.DG_SIGN_OUT=Object.freeze({execute});
})(window);
