"use strict";
/* Prefer healthy mirrors, then those with the most recent successful response. */
(function(root){
  function select(urls,health,now){
    return urls.map((url,index)=>{
      const status=health.get(url)||{};
      return {url,index,badUntil:status.badUntil||0,lastOk:status.lastOk||0};
    }).filter(item=>item.badUntil<=now).sort((a,b)=>{
      if(a.lastOk!==b.lastOk)return b.lastOk-a.lastOk;
      return a.index-b.index;
    });
  }
  root.DG_SELECT_OVERPASS_MIRRORS=Object.freeze({select});
})(window);
