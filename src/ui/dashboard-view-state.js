"use strict";
(function(root){
 function create(document){
  return Object.freeze({isActive:id=>{const view=document.getElementById(id);return !!view&&view.classList.contains("on");}});
 }
 root.DG_DASHBOARD_VIEW_STATE=Object.freeze({create});
})(window);
