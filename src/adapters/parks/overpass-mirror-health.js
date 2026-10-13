"use strict";
/* Persist per-mirror success timestamps and bounded quarantine windows. */
(function(root){
  function success(health,url,now){health.set(url,{lastOk:now(),badUntil:0});}
  function quarantine(health,url,lastOk,durationMs,now){health.set(url,{lastOk,badUntil:now()+durationMs});}
  root.DG_OVERPASS_MIRROR_HEALTH=Object.freeze({success,quarantine});
})(window);
