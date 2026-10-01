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
 * index.html inline script'inden birebir taşındı (Faz 1, modülerleştirme).
 * Tüm modüller (auth, admin, gridplan, landcover…) toast()'ı global çağırır;
 * bu dosya body sonunda, state.js'ten sonra ve shell.js'ten önce yüklenir. */
function toast(msg,type="ok",icon=""){
 const wrap=$("toastWrap");if(!wrap)return;
 const t=document.createElement("div");
 t.className="toast "+(type==="err"||type==="warn"||type==="info"?type:"");
 const ic=icon||(type==="err"?"❌":type==="warn"?"⚠":type==="info"?"ℹ":"✓");
 t.innerHTML=`<span class="icon">${ic}</span><span class="msg">${msg}</span><span class="x" onclick="this.parentNode.classList.add('bye');setTimeout(()=>this.parentNode.remove(),300)">✕</span>`;
 wrap.appendChild(t);
 setTimeout(()=>{if(t.parentNode){t.classList.add("bye");setTimeout(()=>t.remove(),300);}},4500);
}
