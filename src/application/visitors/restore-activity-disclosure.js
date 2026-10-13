"use strict";
(function(root){
 function restore(ports){
  let open=true;
  try{open=ports.read()!=="0";}catch(error){}
  ports.render(open);
  return open;
 }
 root.DG_RESTORE_VISITOR_ACTIVITY_DISCLOSURE=Object.freeze({restore});
})(window);
