"use strict";

/* Keep the field GPS CTA's established loading and restore behavior in one UI module. */
window.DG_MEASUREMENT_GPS_BUTTON={
  setBusy(on,getElement){
    const button=getElement("gpsBtn");if(!button)return;
    if(on){button.dataset.oldText=button.innerHTML;button.innerHTML="⏳ Konum alınıyor…";button.disabled=true;button.style.opacity=".65";button.style.cursor="wait";}
    else{button.disabled=false;button.innerHTML=button.dataset.oldText||"📡 Konumu Etkinleştir";button.style.opacity="";button.style.cursor="";}
  }
};
