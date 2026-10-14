"use strict";
/* Keep the existing park/detail total deadlines and per-mirror timeout caps. */
(function(root){
  const detailed=label=>label==="yüzey+su"||label==="su+yol";
  function deadline(label,now){return now()+(label==="park"?15000:detailed(label)?75000:20000);}
  function timeout(label,until,now){return Math.max(0,Math.min(label==="park"?7500:detailed(label)?40000:10000,until-now()));}
  root.DG_OVERPASS_REQUEST_BUDGET=Object.freeze({deadline,timeout});
})(window);
