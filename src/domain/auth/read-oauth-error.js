"use strict";
(function(root){
 function read(search){
  const m=/[?&]error=([^&]+)/.exec(search||"");
  return m?decodeURIComponent(m[1]):null;
 }
 root.DG_AUTH_OAUTH_ERROR=Object.freeze({read});
})(window);
