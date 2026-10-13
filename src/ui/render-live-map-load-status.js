"use strict";

window.DG_RENDER_LIVE_MAP_LOAD_STATUS={
  loading(element){if(!element)return;element.style.display="";element.className="alert info";element.textContent="⏳ Onaylı kayıtlar yükleniyor…";},
  error(element,message,escapeHTML){if(!element)return;element.style.display="";element.className="alert err";element.innerHTML=`<b>⚠ Onaylı kayıtlar yüklenemedi</b> — harita bu yüzden boş. Veri silinmedi: <span class="mono" style="font-size:.74rem">${escapeHTML(message)}</span> <button class="btn sm" style="margin-left:6px" onclick="loadLiveMap()">↻ Yeniden dene</button>`;},
  loaded(element,count,degraded,format,setTimer){if(!element)return;element.className=degraded?"alert warn":"alert ok";element.textContent=format(degraded?"⚠ {n} onaylı kayıt yüklendi · {t} · kümeleme eklentisi yüklenemedi, noktalar tek tek çizildi.":"✓ {n} onaylı kayıt yüklendi · {t} · noktaya dokun → bilgi + fotoğraf.",{n:count,t:new Date().toLocaleTimeString("tr-TR")});setTimer(()=>element.style.display="none",6000);}
};
