"use strict";

/* Present access/network failures without changing the park schema readiness gate. */
window.DG_SHOW_PARK_COMPARISON_DENIED={
 show(error,{isAdmin,log,getElement,render,escape,toast,translate}){
  const code=(error&&(error.code||error.status))||"";
  const message=(error&&error.message)||String(error||"bilinmeyen hata");
  log(code,message);
  const element=getElement();
  if(element)element.innerHTML=render({code,message,isAdmin:isAdmin(),escape});
  toast(translate("Park karşılaştırması yüklenemedi: ")+(code||message),"warn","🌳");
 }
};
