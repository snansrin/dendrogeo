"use strict";
(function(root){
 function select(tab,ports){
  const selected=tab==="reg"?"reg":tab==="reset"?"reset":"login";
  for(const name of ["login","reg","reset"]){
   const id="f"+name[0].toUpperCase()+name.slice(1),element=ports.getElement(id);
   if(element)element.style.display=name===selected?"block":"none";
  }
  ports.setTab(selected);
  ports.markVisible();
  ports.loadCaptcha();
  ports.initializeCaptcha();
  return selected;
 }
 root.DG_SELECT_AUTH_TAB=Object.freeze({select});
})(window);
