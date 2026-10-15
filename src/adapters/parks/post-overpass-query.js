"use strict";
/* HTTP transport for Overpass; retry policy and mirror health remain in the service. */
(function(root){
  async function post(url,query,{signal,fetchImpl=root.fetch}={}){
    return fetchImpl(url,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","Accept":"application/json"},
      body:"data="+encodeURIComponent(query),
      signal,
      cache:"no-store"
    });
  }
  root.DG_POST_OVERPASS_QUERY=Object.freeze({post});
})(window);
