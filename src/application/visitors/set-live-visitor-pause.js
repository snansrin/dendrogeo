"use strict";
(function(root){
 function set(paused,ports){
  return paused?ports.showPaused():ports.render();
 }
 root.DG_SET_LIVE_VISITOR_PAUSE=Object.freeze({set});
})(window);
