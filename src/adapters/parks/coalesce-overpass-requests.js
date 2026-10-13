"use strict";
/* Share one promise for equal normalized queries while keeping labels at call time. */
(function(root){
  function request(query,label,{keyOf,pending,run}){
    const key=keyOf(query);
    if(pending.has(key))return pending.get(key);
    const job=run(query,label).finally(()=>pending.delete(key));
    pending.set(key,job);
    return job;
  }
  root.DG_COALESCE_OVERPASS_REQUESTS=Object.freeze({request});
})(window);
