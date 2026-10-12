"use strict";
(function(root){
 function render(message,escape){
  return `<b>⚠ Dünya verisi yüklenemedi</b> — sayılar/harita bu yüzden boş olabilir. Kayıt silinmedi: <span class="mono" style="font-size:.74rem">${escape(message)}</span> <button class="btn sm" style="margin-left:6px" onclick="loadWorld()">↻ Yeniden dene</button>`;
 }
 root.DG_WORLD_ERROR_UI=Object.freeze({render});
})(window);
