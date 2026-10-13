"use strict";
/* Canonicalize whitespace without changing the actual query sent to Overpass. */
(function(root){
  function normalize(query){return query.replace(/\s+/g," ").trim();}
  root.DG_OVERPASS_CACHE_KEY=Object.freeze({normalize});
})(window);
