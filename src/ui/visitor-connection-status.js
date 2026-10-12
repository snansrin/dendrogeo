"use strict";

/* Present the current connection state without owning presence or pause state. */
(function(root){
 function render(element,state,visibleCount,totalCount){
  if(!element)return;
  element.textContent=(state==="on"?"Canlı bağlantı":"Bağlantı: "+state)+" · "+visibleCount+" / "+totalCount+" kullanıcı · "+new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
  const wrapper=element.closest(".visitor-connection");
  if(wrapper)wrapper.dataset.state=state;
 }
 function paused(element){
  if(element)element.textContent="Görünüm duraklatıldı";
 }
 root.DG_VISITOR_CONNECTION_STATUS_UI=Object.freeze({render,paused});
})(window);
