"use strict";
(function(root){
 async function review(sb,id,status,shared){
  const payload=root.DG_ADMIN_MEASUREMENT_REVIEW_PAYLOAD.build(status,shared);
  return root.DG_ADMIN_MODERATION_STORE.updateStatus(sb,id,payload);
 }
 root.DG_ADMIN_REVIEW_MEASUREMENT=Object.freeze({review});
})(window);
