"use strict";
(function(root){
 function show(element,box,tab,ports){
  if(!element)return false;
  element.scrollIntoView({behavior:"smooth"});
  ports.selectTab(tab||"login");
  box.classList.remove("auth-glow");
  void box.offsetWidth;
  box.classList.add("auth-glow");
  ports.schedule(()=>box.classList.remove("auth-glow"),3000);
  return true;
 }
 root.DG_SHOW_AUTH_PANEL=Object.freeze({show});
})(window);
