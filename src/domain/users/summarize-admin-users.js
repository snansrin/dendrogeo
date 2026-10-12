"use strict";
(function(root){
 function summarize(users){
  const total=users.length,active=users.filter(user=>user.active).length;
  return{total,active,admins:users.filter(user=>user.role==="admin"||user.role==="owner").length,passive:total-active};
 }
 root.DG_USER_ADMIN_SUMMARY=Object.freeze({summarize});
})(window);
