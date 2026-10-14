"use strict";
/* Add the exact client-side geofence audit fields to a measurement payload. */
(function(root){
  function stamp(base,decision,{now}={}){
    if(!base||!decision||!decision.fix)return base;
    base.geo_acc_m=decision.acc!=null?Math.round(decision.acc):null;
    base.geo_dist_m=decision.distM;
    if(decision.verified)base.geo_verified_at=now().toISOString();
    return base;
  }
  root.DG_GEOFENCE_AUDIT_STAMP=Object.freeze({stamp});
})(window);
