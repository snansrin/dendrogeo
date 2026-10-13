"use strict";
(function(root){
 async function execute(allowed,ports){
  if(!allowed()||ports.isRefreshing())return;
  ports.resume();ports.setRefreshing(true);
  try{ports.render();await Promise.all([ports.counts(),ports.activity()]);}
  finally{ports.setRefreshing(false);}
 }
 root.DG_REFRESH_OWNER_VISITOR_VIEW=Object.freeze({execute});
})(window);
