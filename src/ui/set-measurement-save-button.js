"use strict";

/* Render the live disabled/wait state and restore the normal edit-aware label. */
window.DG_SET_MEASUREMENT_SAVE_BUTTON={
  setBusy(busy,ports){
    const button=ports.button;if(!button)return;
    if(busy){button.dataset.oldText=button.innerHTML;button.innerHTML="⏳ Hesaplanıyor ve kaydediliyor…";button.disabled=true;button.style.opacity=".65";button.style.cursor="wait";}
    else{button.disabled=false;button.textContent=ports.editing?"💾 Kaydı Güncelle":"💾 Hesapla ve Kaydet";button.style.opacity="";button.style.cursor="";if(typeof ports.parkGate==="function")ports.parkGate();}
  }
};
