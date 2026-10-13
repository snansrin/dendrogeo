"use strict";
(function(root){
 function toggle(isOpen,ports){
  const nextOpen=!isOpen;
  ports.render(nextOpen);
  try{ports.persist(nextOpen);}catch(error){}
  return nextOpen;
 }
 root.DG_TOGGLE_VISITOR_ACTIVITY_DISCLOSURE=Object.freeze({toggle});
})(window);
