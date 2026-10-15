"use strict";

window.DG_RENDER_LIVE_MAP_LOAD_STATUS=(()=>{
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bind(element,actions){if(!element||typeof element.addEventListener!=="function")return;actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);element.addEventListener("click",event=>{const button=event.target?.closest?.('[data-live-map-action="retry"]');if(button&&element.contains(button))actionsByElement.get(element)?.retry?.();});}
 return {
  loading(element){if(!element)return;element.style.display="";element.className="alert info";element.textContent="⏳ Onaylı kayıtlar yükleniyor…";},
  error(element,message,escapeHTML,retry){if(!element)return;bind(element,{retry});element.style.display="";element.className="alert err";element.innerHTML=`<b>⚠ Onaylı kayıtlar yüklenemedi</b> — harita bu yüzden boş. Veri silinmedi: <span class="mono" style="font-size:.74rem">${escapeHTML(message)}</span> <button class="btn sm" style="margin-left:6px" data-live-map-action="retry">↻ Yeniden dene</button>`;},
  loaded(element,count,degraded,format,setTimer){if(!element)return;element.className=degraded?"alert warn":"alert ok";element.textContent=format(degraded?"⚠ {n} onaylı kayıt yüklendi · {t} · kümeleme eklentisi yüklenemedi, noktalar tek tek çizildi.":"✓ {n} onaylı kayıt yüklendi · {t} · noktaya dokun → bilgi + fotoğraf.",{n:count,t:new Date().toLocaleTimeString("tr-TR")});setTimer(()=>element.style.display="none",6000);},bind
 };
})();
