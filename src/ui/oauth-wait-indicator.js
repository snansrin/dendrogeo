"use strict";
(function(root){
 function show(getElement,message){
  const el=getElement("oauthWait");
  if(el){el.style.display="block";el.textContent=message||"⏳ Google girişi tamamlanıyor…";}
 }
 function hide(getElement){
  const el=getElement("oauthWait");
  if(el)el.style.display="none";
 }
 root.DG_AUTH_OAUTH_WAIT_UI=Object.freeze({show,hide});
})(window);
