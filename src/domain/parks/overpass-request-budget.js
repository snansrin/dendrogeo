"use strict";
/* Keep the existing park/detail total deadlines and per-mirror timeout caps. */
(function(root){
  function deadline(label,now){return now()+(label==="park"?15000:20000);}
  function timeout(label,until,now){return Math.min(label==="park"?7500:10000,until-now());}
  root.DG_OVERPASS_REQUEST_BUDGET=Object.freeze({deadline,timeout});
})(window);
