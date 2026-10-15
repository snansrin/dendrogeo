"use strict";

/* Keep the activity panel, translated button and aria-expanded in sync. */
(function(root){
 function isOpen(wrapper){return !!wrapper&&wrapper.style.display!=="none";}
 function render(wrapper,button,open,{translate=value=>value}={}){
  if(!wrapper)return;
  wrapper.style.display=open?"":"none";
  if(button){
   button.innerHTML=open?translate("⬆ Gizle"):translate("⬇ Göster");
   button.setAttribute("aria-expanded",String(open));
  }
 }
 root.DG_VISITOR_ACTIVITY_DISCLOSURE_UI=Object.freeze({isOpen,render});
})(window);
