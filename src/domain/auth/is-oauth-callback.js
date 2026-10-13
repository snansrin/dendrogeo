"use strict";
(function(root){
 function isCallback(location){
  const s=(location&&location.search)||"";
  const h=(location&&location.hash)||"";
  return /[?&]code=/.test(s)||/access_token=/.test(h)||/[?&]error=/.test(s);
 }
 root.DG_AUTH_OAUTH_CALLBACK=Object.freeze({isCallback});
})(window);
