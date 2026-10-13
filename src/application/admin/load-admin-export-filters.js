"use strict";
(function(root){
 async function execute(ports){
  try{const[measurements,projects]=await ports.load();ports.apply(measurements,projects);}
  catch(error){}
 }
 root.DG_LOAD_ADMIN_EXPORT_FILTERS=Object.freeze({execute});
})(window);
