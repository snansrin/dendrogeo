"use strict";

/* Share one drain promise across login, online, and shell sync triggers. */
(function(root){
  async function run({getUser,isOnline,updateBadge,drain}){
    if(!isOnline())return;
    const user=getUser();
    if(!user){await updateBadge();return;}
    if(root.DG_OFFLINE_SYNC)return root.DG_OFFLINE_SYNC;
    const owner=String(user.id);
    root.DG_OFFLINE_SYNC=Promise.resolve().then(()=>drain(owner));
    try{return await root.DG_OFFLINE_SYNC;}
    finally{root.DG_OFFLINE_SYNC=null;await updateBadge();}
  }
  root.DG_COORDINATE_OFFLINE_MEASUREMENT_SYNC=Object.freeze({run});
})(window);
