/* toastWrap canlı bölge ilan edilir (0035 · P1-5): build çapası
 * '<div id="toastWrap"></div>' index.html bölme ANCHORS'ında kilitli olduğu
 * için nitelikler STATİK yazılamaz → çalışma zamanında atanır. Ekran okuyucu
 * toast'ları artık duyurur. */
(function dgToastA11y(){
 const set=()=>{const w=document.getElementById("toastWrap");
  if(w){w.setAttribute("role","status");w.setAttribute("aria-live","polite");}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",set);else set();
})();
"use strict";
/* DendroGeo · ui/toast.js — ortak bildirim baloncukları.
 * Süre dördüncü parametreyle isteğe bağlıdır; eski üç-parametreli çağrılar
 * aynen 4,5 saniye davranışını korur. Uzun saha yardımları 15 saniyeyi,
 * yanlışlıkla verilen çok küçük değerler 1,8 saniyeyi aşamaz. */
function toast(msg,type="ok",icon="",duration=4500){
 const wrap=$("toastWrap");if(!wrap)return;
 if(!wrap._dgToastActionsBound&&typeof wrap.addEventListener==="function"){wrap._dgToastActionsBound=true;wrap.addEventListener("click",event=>{const button=event.target?.closest?.("button.dg-toast-close");if(!button||!wrap.contains(button))return;const toastElement=button.parentNode;toastElement?.classList.add("bye");setTimeout(()=>toastElement?.remove(),300);});}
 const t=document.createElement("div");
 t.className="toast "+(type==="err"||type==="warn"||type==="info"?type:"");
 const ic=icon||(type==="err"?"❌":type==="warn"?"⚠":type==="info"?"ℹ":"✓");
 t.innerHTML=`<span class="icon">${ic}</span><span class="msg">${msg}</span><button type="button" class="x dg-toast-close" aria-label="Bildirimi kapat">✕</button>`;
 wrap.appendChild(t);
 const ms=Math.max(1800,Math.min(15000,Number(duration)||4500));
 setTimeout(()=>{if(t.parentNode){t.classList.add("bye");setTimeout(()=>t.remove(),300);}},ms);
}
