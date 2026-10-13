"use strict";

/* Present the existing transient status while a park-scoped channel connects. */
window.DG_PARK_LIVE_SHARE_CONNECTION_UI={
  connecting({element,translate}){
    if(element)element.textContent=translate("⏳ gerçek zamanlı katmana bağlanılıyor…");
  }
};
