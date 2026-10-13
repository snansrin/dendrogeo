"use strict";
/* Count unresolved water-boundary cells once per stable cell key. */
(function(root){
  function count(parts=[]){const keys=new Set();for(const part of parts)if(part.type==="other")keys.add(part.key);return keys.size;}
  root.DG_COUNT_UNRESOLVED_SURFACE_WATER_PARTS=Object.freeze({count});
})(window);
