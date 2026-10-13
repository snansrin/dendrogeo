"use strict";
(function(root){
 async function review(sb,id,status,shared,store){
  const payload=root.DG_ADMIN_MEASUREMENT_REVIEW_PAYLOAD.build(status,shared);
  return store.updateStatus(sb,id,payload);
 }
 root.DG_ADMIN_REVIEW_MEASUREMENT=Object.freeze({review});
})(window);
