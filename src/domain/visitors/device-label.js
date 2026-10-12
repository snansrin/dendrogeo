"use strict";

/* Preserve the existing presence device label and user-agent match precedence. */
(function(root){
 function build(userAgent){
  const ua=userAgent||"";
 const br=/Edg\//.test(ua)?"Edge":/OPR\//.test(ua)?"Opera":/Chrome\//.test(ua)?"Chrome":/Firefox\//.test(ua)?"Firefox":/Safari\//.test(ua)?"Safari":"?";
 const os=/Windows/.test(ua)?"Windows":/Android/.test(ua)?"Android":/iPhone|iPad|iPod/.test(ua)?"iOS":/Mac OS X/.test(ua)?"macOS":/Linux/.test(ua)?"Linux":"?";
 return (/Mobi|Android|iPhone|iPad|iPod/.test(ua)?"mobil":"masaüstü")+" · "+os+" · "+br;
 }
 root.DG_VISITOR_DEVICE_LABEL=Object.freeze({build});
})(window);
