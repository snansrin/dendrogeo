"use strict";
(function(root){
 function fit(setFit,filter,rows,draw){
  setFit(false);
  return draw(filter(rows));
 }
 root.DG_FIT_LIVE_VISITOR_MAP=Object.freeze({fit});
})(window);
